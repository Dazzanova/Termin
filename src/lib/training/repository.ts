import db from "../db/database";
import type { Contest } from "../contests/types";
import type {
  Problem,
  ProblemReview,
  ReviewAction,
  ReviewEntry,
  ReviewStatus,
  Submission,
  TrainingAccount,
  TrainingPlatform,
} from "./types";

type AccountRow = {
  platform: TrainingPlatform;
  handle: string;
  linked_at: string;
};

type ProblemRow = {
  id: string;
  platform: TrainingPlatform;
  contest_id: string;
  problem_index: string;
  name: string;
  rating: number | null;
  tags: string;
  url: string;
};

type SubmissionRow = {
  id: string;
  platform: TrainingPlatform;
  problem_id: string;
  verdict: string;
  submitted_at: string;
};

type ReviewRow = {
  problem_id: string;
  status: ReviewStatus;
  due_at: string;
  interval_days: number;
  attempts: number;
  updated_at: string;
};

type ReviewJoinRow = ReviewRow & ProblemRow;

/**
 * Spaced repetition intervals, in days. `again` advances one step each time,
 * so a problem you keep failing comes back sooner than one you nearly had.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 21] as const;

const getAccountStatement = db.prepare(`
  SELECT platform, handle, linked_at
  FROM platform_accounts
  WHERE platform = ?
`);

const saveAccountStatement = db.prepare(`
  INSERT INTO platform_accounts (platform, handle, linked_at)
  VALUES (?, ?, ?)
  ON CONFLICT(platform) DO UPDATE SET
    handle = excluded.handle,
    linked_at = excluded.linked_at
`);

const upsertProblemStatement = db.prepare(`
  INSERT INTO problems (
    id, platform, contest_id, problem_index, name, rating, tags, url, imported_at
  )
  VALUES (@id, @platform, @contest_id, @problem_index, @name, @rating, @tags, @url, @imported_at)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    rating = excluded.rating,
    tags = excluded.tags,
    url = excluded.url,
    imported_at = excluded.imported_at
`);

const insertSubmissionStatement = db.prepare(`
  INSERT INTO submissions (id, platform, problem_id, verdict, submitted_at)
  VALUES (@id, @platform, @problem_id, @verdict, @submitted_at)
  ON CONFLICT(id) DO NOTHING
`);

const deleteSubmissionsStatement = db.prepare(`
  DELETE FROM submissions WHERE platform = ?
`);

const solvedStatement = db.prepare(`
  SELECT DISTINCT problem_id FROM submissions
  WHERE platform = ? AND verdict = 'OK'
`);

const problemsByContestStatement = db.prepare(`
  SELECT id, platform, contest_id, problem_index, name, rating, tags, url
  FROM problems
  WHERE platform = ? AND contest_id = ?
  ORDER BY problem_index ASC
`);

const getProblemStatement = db.prepare(`
  SELECT id, platform, contest_id, problem_index, name, rating, tags, url
  FROM problems
  WHERE id = ?
`);

const insertReviewStatement = db.prepare(`
  INSERT INTO problem_reviews (problem_id, status, due_at, interval_days, attempts, updated_at)
  VALUES (?, 'due', ?, 1, 0, ?)
  ON CONFLICT(problem_id) DO NOTHING
`);

const getReviewStatement = db.prepare(`
  SELECT problem_id, status, due_at, interval_days, attempts, updated_at
  FROM problem_reviews
  WHERE problem_id = ?
`);

const closeReviewStatement = db.prepare(`
  UPDATE problem_reviews
  SET status = 'done', updated_at = ?
  WHERE problem_id = ? AND status IN ('due', 'scheduled')
`);

const setReviewStatement = db.prepare(`
  UPDATE problem_reviews
  SET status = @status,
      due_at = @due_at,
      interval_days = @interval_days,
      attempts = @attempts,
      updated_at = @updated_at
  WHERE problem_id = @problem_id
`);

const saveReviewStatement = db.prepare(`
  INSERT INTO problem_reviews (problem_id, status, due_at, interval_days, attempts, updated_at)
  VALUES (@problem_id, @status, @due_at, @interval_days, @attempts, @updated_at)
  ON CONFLICT(problem_id) DO UPDATE SET
    status = excluded.status,
    due_at = excluded.due_at,
    interval_days = excluded.interval_days,
    attempts = excluded.attempts,
    updated_at = excluded.updated_at
`);

const reviewsStatement = db.prepare(`
  SELECT
    r.problem_id, r.status, r.due_at, r.interval_days, r.attempts, r.updated_at,
    p.id, p.platform, p.contest_id, p.problem_index, p.name, p.rating, p.tags, p.url
  FROM problem_reviews r
  JOIN problems p ON p.id = r.problem_id
  ORDER BY r.due_at ASC
`);

const dueReviewsStatement = db.prepare(`
  SELECT
    r.problem_id, r.status, r.due_at, r.interval_days, r.attempts, r.updated_at,
    p.id, p.platform, p.contest_id, p.problem_index, p.name, p.rating, p.tags, p.url
  FROM problem_reviews r
  JOIN problems p ON p.id = r.problem_id
  WHERE r.status IN ('due', 'scheduled') AND r.due_at <= ?
  ORDER BY r.due_at ASC
  LIMIT ?
`);

const reviewCountsStatement = db.prepare(`
  SELECT
    SUM(CASE WHEN status IN ('due', 'scheduled') AND due_at <= @now THEN 1 ELSE 0 END) AS due,
    SUM(CASE WHEN status IN ('due', 'scheduled') AND due_at >  @now THEN 1 ELSE 0 END) AS upcoming,
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
  FROM problem_reviews
`);

const countProblemsStatement = db.prepare(
  "SELECT COUNT(*) AS count FROM problems"
);
const countSubmissionsStatement = db.prepare(
  "SELECT COUNT(*) AS count FROM submissions"
);

const setTrainingStateStatement = db.prepare(`
  INSERT INTO training_state (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getTrainingStateStatement = db.prepare(
  "SELECT value FROM training_state WHERE key = ?"
);

const attendedContestsStatement = db.prepare(`
  SELECT c.id, c.platform, c.name, c.start_time, c.duration_seconds, c.url
  FROM contests c
  JOIN participation p ON p.contest_id = c.id
  WHERE p.status = 'participated' AND c.start_time < ?
  ORDER BY c.start_time DESC
`);

function rowToProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    platform: row.platform,
    contestId: row.contest_id,
    index: row.problem_index,
    name: row.name,
    rating: row.rating,
    tags: JSON.parse(row.tags || "[]") as string[],
    url: row.url,
  };
}

function rowToReview(row: ReviewRow): ProblemReview {
  return {
    problemId: row.problem_id,
    status: row.status,
    dueAt: new Date(row.due_at),
    intervalDays: row.interval_days,
    attempts: row.attempts,
    updatedAt: new Date(row.updated_at),
  };
}

function rowToReviewEntry(row: ReviewJoinRow): ReviewEntry {
  return {
    review: rowToReview(row),
    problem: rowToProblem(row),
  };
}

export function getAccount(
  platform: TrainingPlatform = "codeforces"
): TrainingAccount | null {
  const row = getAccountStatement.get(platform) as AccountRow | undefined;

  return row
    ? {
        platform: row.platform,
        handle: row.handle,
        linkedAt: new Date(row.linked_at),
      }
    : null;
}

export function saveAccount(
  handle: string,
  platform: TrainingPlatform = "codeforces"
): void {
  saveAccountStatement.run(platform, handle, new Date().toISOString());
}

export function countProblems(): number {
  return (countProblemsStatement.get() as { count: number }).count;
}

export function countSubmissions(): number {
  return (countSubmissionsStatement.get() as { count: number }).count;
}

export function saveProblems(problems: Problem[]): void {
  const now = new Date().toISOString();

  const transaction = db.transaction((items: Problem[]) => {
    for (const problem of items) {
      upsertProblemStatement.run({
        id: problem.id,
        platform: problem.platform,
        contest_id: problem.contestId,
        problem_index: problem.index,
        name: problem.name,
        rating: problem.rating,
        tags: JSON.stringify(problem.tags),
        url: problem.url,
        imported_at: now,
      });
    }
  });

  transaction(problems);
}

export function replaceSubmissions(
  submissions: Submission[],
  platform: TrainingPlatform = "codeforces"
): void {
  const transaction = db.transaction(() => {
    deleteSubmissionsStatement.run(platform);

    for (const submission of submissions) {
      insertSubmissionStatement.run({
        id: submission.id,
        platform: submission.platform,
        problem_id: submission.problemId,
        verdict: submission.verdict,
        submitted_at: submission.submittedAt.toISOString(),
      });
    }
  });

  transaction();
}

export function getSolvedProblemIds(
  platform: TrainingPlatform = "codeforces"
): Set<string> {
  const rows = solvedStatement.all(platform) as { problem_id: string }[];
  return new Set(rows.map((row) => row.problem_id));
}

export function getProblemsByContest(
  contestId: string,
  platform: TrainingPlatform = "codeforces"
): Problem[] {
  const rows = problemsByContestStatement.all(
    platform,
    contestId
  ) as ProblemRow[];
  return rows.map(rowToProblem);
}

export function getProblem(id: string): Problem | null {
  const row = getProblemStatement.get(id) as ProblemRow | undefined;
  return row ? rowToProblem(row) : null;
}

/** Adds a due review if the problem is not tracked yet. Returns true when inserted. */
export function ensureReview(
  problemId: string,
  now: Date = new Date()
): boolean {
  const result = insertReviewStatement.run(
    problemId,
    now.toISOString(),
    now.toISOString()
  );
  return result.changes > 0;
}

/** Upserts a review row; used by fixtures and tests. */
export function saveReview(review: ProblemReview): void {
  saveReviewStatement.run({
    problem_id: review.problemId,
    status: review.status,
    due_at: review.dueAt.toISOString(),
    interval_days: review.intervalDays,
    attempts: review.attempts,
    updated_at: review.updatedAt.toISOString(),
  });
}

export function getReview(problemId: string): ProblemReview | null {
  const row = getReviewStatement.get(problemId) as ReviewRow | undefined;
  return row ? rowToReview(row) : null;
}

/** Closes an active review; returns true when a row changed. */
export function closeReview(
  problemId: string,
  now: Date = new Date()
): boolean {
  return closeReviewStatement.run(now.toISOString(), problemId).changes > 0;
}

export function applyReviewAction(
  problemId: string,
  action: ReviewAction,
  now: Date = new Date()
): ProblemReview | null {
  const review = getReview(problemId);

  if (!review) {
    return null;
  }

  if (action === "solved" || action === "drop") {
    setReviewStatement.run({
      problem_id: problemId,
      status: action === "solved" ? "done" : "dropped",
      due_at: review.dueAt.toISOString(),
      interval_days: review.intervalDays,
      attempts: review.attempts,
      updated_at: now.toISOString(),
    });

    return getReview(problemId);
  }

  const intervalDays =
    REVIEW_INTERVALS[
      Math.min(review.attempts, REVIEW_INTERVALS.length - 1)
    ];
  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000);

  setReviewStatement.run({
    problem_id: problemId,
    status: "scheduled",
    due_at: dueAt.toISOString(),
    interval_days: intervalDays,
    attempts: review.attempts + 1,
    updated_at: now.toISOString(),
  });

  return getReview(problemId);
}

export function listReviews(): ReviewEntry[] {
  const rows = reviewsStatement.all() as ReviewJoinRow[];
  return rows.map(rowToReviewEntry);
}

export function listDueReviews(
  now: Date = new Date(),
  limit = 5
): ReviewEntry[] {
  const rows = dueReviewsStatement.all(
    now.toISOString(),
    limit
  ) as ReviewJoinRow[];
  return rows.map(rowToReviewEntry);
}

export function getReviewCounts(now: Date = new Date()): {
  due: number;
  upcoming: number;
  done: number;
} {
  const row = reviewCountsStatement.get({ now: now.toISOString() }) as {
    due: number | null;
    upcoming: number | null;
    done: number | null;
  };

  return {
    due: row?.due ?? 0,
    upcoming: row?.upcoming ?? 0,
    done: row?.done ?? 0,
  };
}

export function setTrainingState(key: string, value: string): void {
  setTrainingStateStatement.run(key, value);
}

export function getTrainingState(key: string): string | null {
  const row = getTrainingStateStatement.get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

/** Contests marked participated whose start time has passed. */
export function getAttendedContests(): Contest[] {
  const rows = attendedContestsStatement.all(
    new Date().toISOString()
  ) as {
    id: string;
    platform: Contest["platform"];
    name: string;
    start_time: string;
    duration_seconds: number;
    url: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
  }));
}
