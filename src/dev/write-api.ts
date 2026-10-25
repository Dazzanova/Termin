import type { IncomingMessage, ServerResponse } from "node:http";
import type { AstroIntegration } from "astro";
import type { ParticipationStatus } from "../lib/contests/types";
import type { UserPreferences } from "../lib/preferences/types";

/**
 * Termin builds to static files, so there is no server to answer write
 * requests: `npm run build` produces read-only HTML. While developing, though,
 * the dashboard should be usable, so this integration mounts the write API on
 * the Vite dev server.
 *
 * It is a single layer on purpose. Astro endpoints marked `prerender = false`
 * would need an adapter and break the static build, and a static endpoint
 * silently discards the request body, so every POST looked like malformed JSON.
 */

const SETTINGS_PATHS = new Set(["/settings", "/settings/"]);

type Submission = {
  accept: string;
  body: string;
};

type JsonReply = {
  status: number;
  json: unknown;
};

type ParticipationModule = {
  saveParticipationStatus: (
    contestId: string,
    status: ParticipationStatus | null
  ) => void;
};

type PreferencesModule = {
  savePreferences: (preferences: Partial<UserPreferences>) => void;
  saveSubmittedPlatforms: (platforms: unknown) => void;
};

type SyncModule = {
  syncContests: () => Promise<{
    contests: unknown[];
    changes: unknown[];
    failedProviders: string[];
  }>;
};

const PARTICIPATION_STATUSES: (ParticipationStatus | "")[] = [
  "planned",
  "participated",
  "skipped",
  "",
];

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  json: unknown
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(json));
}

function parseBody(body: string): Record<string, unknown> {
  const parsed = JSON.parse(body || "{}");
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function devWriteApi(): AstroIntegration {
  return {
    name: "termin-dev-write-api",
    hooks: {
      "astro:server:setup": ({ server }) => {
        // Modules the pages use, so writes land in the same SQLite handle.
        const load = <T>(id: string) => server.ssrLoadModule(id) as Promise<T>;

        // One sync per dev-server process; `syncContests` reports provider
        // failures instead of rejecting, so this only blocks true overlap.
        let syncRunning = false;

        const handlers: Record<
          string,
          (submission: Submission) => Promise<JsonReply>
        > = {
          "/api/participation": async ({ body }) => {
            const { contestId, status } = parseBody(body);

            if (!contestId || typeof contestId !== "string") {
              return { status: 400, json: { error: "Invalid contestId" } };
            }

            if (
              status === undefined ||
              !PARTICIPATION_STATUSES.includes(
                status as ParticipationStatus | ""
              )
            ) {
              return { status: 400, json: { error: "Invalid status" } };
            }

            const { saveParticipationStatus } =
              await load<ParticipationModule>(
                "/src/lib/contests/repository.ts"
              );

            saveParticipationStatus(contestId, (status || null) as
              | ParticipationStatus
              | null);

            return { status: 200, json: { ok: true } };
          },

          "/api/preferences": async ({ body }) => {
            const { savePreferences } =
              await load<PreferencesModule>(
                "/src/lib/preferences/repository.ts"
              );

            savePreferences(parseBody(body) as Partial<UserPreferences>);

            return { status: 200, json: { ok: true } };
          },

          "/api/sync": async () => {
            if (syncRunning) {
              return {
                status: 409,
                json: { error: "A sync is already running" },
              };
            }

            syncRunning = true;

            try {
              const { syncContests } =
                await load<SyncModule>("/src/lib/contests/sync.ts");
              const result = await syncContests();

              return {
                status: 200,
                json: {
                  ok: result.failedProviders.length === 0,
                  synced: result.contests.length,
                  changes: result.changes.length,
                  failedProviders: result.failedProviders,
                },
              };
            } catch (error) {
              server.config.logger.error(
                `sync failed: ${(error as Error).message}`
              );
              return { status: 500, json: { error: "Sync failed" } };
            } finally {
              syncRunning = false;
            }
          },
        };

        server.middlewares.use((request, response, next) => {
          if (request.method !== "POST") {
            return next();
          }

          const { pathname } = new URL(
            request.url ?? "/",
            "http://termin.local"
          );
          const isSettings = SETTINGS_PATHS.has(pathname);
          const handler = handlers[pathname];

          if (!isSettings && !handler) {
            return next();
          }

          void (async () => {
            try {
              const { accept, body } = {
                accept: request.headers.accept ?? "",
                body: await readBody(request),
              };

              if (isSettings) {
                const { saveSubmittedPlatforms } =
                  await load<PreferencesModule>(
                    "/src/lib/preferences/repository.ts"
                  );

                saveSubmittedPlatforms(
                  new URLSearchParams(body).getAll("platforms")
                );

                if (accept.includes("application/json")) {
                  sendJson(response, 200, { ok: true, redirect: "/" });
                } else {
                  response.writeHead(302, { Location: "/" });
                  response.end();
                }

                return;
              }

              const reply = await handler!({ accept, body });
              sendJson(response, reply.status, reply.json);
            } catch (error) {
              if (error instanceof SyntaxError) {
                sendJson(response, 400, { error: "Malformed JSON" });
                return;
              }

              server.config.logger.error(
                `${pathname} failed: ${(error as Error).message}`
              );
              sendJson(response, 500, { error: "Internal Server Error" });
            }
          })();
        });
      },
    },
  };
}
