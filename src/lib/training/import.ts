import {
  fetchProblemset,
  fetchRatingHistory,
  fetchSubmissions,
} from "../codeforces/client";
import {
  countProblems,
  countSubmissions,
  getAccount,
  getSolvedProblemIds,
  replaceRatingHistory,
  replaceSubmissions,
  saveAccount,
  saveProblems,
  setTrainingState,
} from "./repository";
import { rebuildUpsolveQueue } from "./upsolve";
import type { ImportSummary } from "./types";

/**
 * Imports the Codeforces catalog, your submission history, and your rating
 * history.
 *
 * All three API calls run before anything is written, so a network failure
 * leaves the database untouched. Writes then happen back to back: catalog,
 * history, rating series, upsolve queue, import stamp.
 */
export async function importCodeforcesData(
  handle?: string,
  now: Date = new Date()
): Promise<ImportSummary> {
  const account = await getAccount("codeforces");
  const target = (handle ?? account?.handle ?? "").trim();

  if (!target) {
    throw new Error("No Codeforces handle linked yet");
  }

  const problems = await fetchProblemset();
  const submissions = await fetchSubmissions(target);
  const ratings = await fetchRatingHistory(target);

  if (account?.handle !== target) {
    await saveAccount(target, "codeforces");
  }

  await saveProblems(problems);
  await replaceSubmissions(submissions);
  await replaceRatingHistory(ratings);

  const { queued, closed } = await rebuildUpsolveQueue(now);

  await setTrainingState("last_import_at", now.toISOString());
  await setTrainingState("last_import_handle", target);

  return {
    problems: await countProblems(),
    submissions: await countSubmissions(),
    solved: (await getSolvedProblemIds("codeforces")).size,
    closedReviews: closed,
    queuedReviews: queued,
    ratedContests: ratings.length,
    currentRating: ratings.at(-1)?.newRating ?? null,
    importedAt: now,
  };
}
