import type { APIRoute } from "astro";
import { isDemoMode } from "../../lib/demo";
import { syncContests } from "../../lib/contests/sync";
import { json, rejectCrossOrigin } from "../../lib/http/api";

// One sync per server process; `syncContests` reports provider failures
// instead of rejecting, so this only blocks true overlap.
let syncRunning = false;

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  if (isDemoMode()) {
    return json({ error: "Sync is disabled in demo mode" }, 403);
  }

  if (syncRunning) {
    return json({ error: "A sync is already running" }, 409);
  }

  syncRunning = true;

  try {
    const result = await syncContests();

    return json({
      ok: result.failedProviders.length === 0,
      synced: result.contests.length,
      changes: result.changes.length,
      failedProviders: result.failedProviders,
    });
  } catch (error) {
    console.error("sync failed:", (error as Error).message);
    return json({ error: "Sync failed" }, 500);
  } finally {
    syncRunning = false;
  }
};
