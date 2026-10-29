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
export async function rebuildUpsolveQueue(
  now: Date = new Date()
): Promise<UpsolveResult> {
  const solved = await getSolvedProblemIds("codeforces");
  let queued = 0;
  let closed = 0;

  for (const contest of await getAttendedContests()) {
    // Only Codeforces is importable for now; other platforms have no catalog.
    if (contest.platform !== "codeforces") {
      continue;
    }

    for (const problem of await getProblemsByContest(
      contest.id,
      "codeforces"
    )) {
      if (solved.has(problem.id)) {
        if (await closeReview(problem.id, now)) {
          closed += 1;
        }
      } else if (await ensureReview(problem.id, now)) {
        queued += 1;
      }
    }
  }

  return { queued, closed };
}
