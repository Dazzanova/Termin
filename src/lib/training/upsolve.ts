import {
  closeReview,
  ensureReview,
  getAttendedContests,
  getProblemsByContest,
  getSolvedProblemIds,
} from "./repository";

export type UpsolveResult = {
  queued: number;
  closed: number;
};

/**
 * Rebuilds the upsolve queue from contests you marked as participated.
 *
 * Every problem in such a contest that has no `OK` submission becomes a due
 * review. Problems solved since the last import close their review instead, so
 * a sync can retire work you already finished outside Termin.
 */
export function rebuildUpsolveQueue(
  now: Date = new Date()
): UpsolveResult {
  const solved = getSolvedProblemIds("codeforces");
  let queued = 0;
  let closed = 0;

  for (const contest of getAttendedContests()) {
    // Only Codeforces is importable for now; other platforms have no catalog.
    if (contest.platform !== "codeforces") {
      continue;
    }

    for (const problem of getProblemsByContest(contest.id, "codeforces")) {
      if (solved.has(problem.id)) {
        if (closeReview(problem.id, now)) {
          closed += 1;
        }
      } else if (ensureReview(problem.id, now)) {
        queued += 1;
      }
    }
  }

  return { queued, closed };
}
