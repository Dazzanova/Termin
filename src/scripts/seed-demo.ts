import { buildDemoDataset } from "../dev/demo-data";
import {
  saveContests,
  saveParticipationStatus,
} from "../lib/contests/repository";
import { savePreferences } from "../lib/preferences/repository";
import {
  markProviderSuccess,
  markSyncCompleted,
} from "../lib/contests/sync-state";
import {
  replaceRatingHistory,
  replaceSubmissions,
  saveAccount,
  saveProblems,
  saveReview,
  setTrainingState,
} from "../lib/training/repository";

/**
 * Writes the demo fixtures into whichever database `TERMIN_DB_PATH` points at.
 * The demo CLI sets that path before importing this module, because the
 * database module freezes its path at import time.
 */
export async function seedDemoData(now: Date = new Date()): Promise<void> {
  const dataset = buildDemoDataset(now);

  await saveContests(dataset.contests);

  for (const entry of dataset.participation) {
    await saveParticipationStatus(entry.contestId, entry.status);
  }

  await savePreferences(dataset.preferences);

  for (const platform of dataset.preferences.enabledPlatforms) {
    await markProviderSuccess(platform);
  }

  const { training } = dataset;

  await saveAccount(training.handle, "codeforces");
  await saveProblems(training.problems);
  await replaceSubmissions(training.submissions, "codeforces");
  await replaceRatingHistory(training.ratings, "codeforces");

  for (const review of training.reviews) {
    await saveReview(review);
  }

  await setTrainingState("last_import_at", now.toISOString());
  await setTrainingState("last_import_handle", training.handle);

  // The demo is a snapshot, so the toolbar should read "Synced just now".
  await markSyncCompleted(true);
}
