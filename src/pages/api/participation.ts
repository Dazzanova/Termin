import type { APIRoute } from "astro";
import { saveParticipationStatus } from "../../lib/contests/repository";
import type { ParticipationStatus } from "../../lib/contests/types";
import { json, readJson, rejectCrossOrigin } from "../../lib/http/api";

const STATUSES: (ParticipationStatus | "")[] = [
  "planned",
  "participated",
  "skipped",
  "",
];

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const { contestId, status } = body;

  if (typeof contestId !== "string" || !contestId) {
    return json({ error: "Invalid contestId" }, 400);
  }

  if (typeof status !== "string" || !STATUSES.includes(status as ParticipationStatus | "")) {
    return json({ error: "Invalid status" }, 400);
  }

  await saveParticipationStatus(
    contestId,
    (status || null) as ParticipationStatus | null
  );

  return json({ ok: true });
};
