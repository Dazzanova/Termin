import { syncContests } from "../lib/contests/sync";

const intervalHours = Number(
  process.env.TERMIN_SYNC_INTERVAL_HOURS ?? 24
);

const intervalMs = intervalHours * 60 * 60 * 1000;

let syncing = false;

async function runSync() {
  if (syncing) {
    return;
  }

  syncing = true;

  try {
    const result = await syncContests();

    console.log(
      `[sync] ${result.contests.length} contests, ${result.changes.length} changes`
    );

    if (result.failedProviders.length > 0) {
      console.error(
        `[sync] failed providers: ${result.failedProviders.join(", ")}`
      );
    }
  } catch (error) {
    console.error("[sync] failed:", error);
  } finally {
    syncing = false;
  }
}

await runSync();

setInterval(runSync, intervalMs);

console.log(
  `[sync] running every ${intervalHours} hours`
);
