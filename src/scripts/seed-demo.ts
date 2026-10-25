import { buildDemoDataset } from "../dev/demo-data";
import { saveContests, saveParticipationStatus } from "../lib/contests/repository";
import { savePreferences } from "../lib/preferences/repository";
import {
  markProviderSuccess,
  markSyncCompleted,
} from "../lib/contests/sync-state";

/**
 * Writes the demo fixtures into whichever database `TERMIN_DB_PATH` points at.
 * The demo CLI sets that path before importing this module, because the
 * database module freezes its path at import time.
 */
export function seedDemoData(now: Date = new Date()): void {
  const dataset = buildDemoDataset(now);

  saveContests(dataset.contests);

  for (const entry of dataset.participation) {
    saveParticipationStatus(entry.contestId, entry.status);
  }

  savePreferences(dataset.preferences);

  for (const platform of dataset.preferences.enabledPlatforms) {
    markProviderSuccess(platform);
  }

  // The demo is a snapshot, so the toolbar should read "Synced just now".
  markSyncCompleted(true);
}
