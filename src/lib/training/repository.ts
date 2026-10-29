import { client, ready } from "../db/database";
import type { Contest } from "../contests/types";
import type {
  Problem,
  ProblemReview,
  RatingEntry,
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

type RatingRow = {
  platform: TrainingPlatform;
  contest_id: string;
  contest_name: string;
  rank: number | null;
  old_rating: number;
  new_rating: number;
  rated_at: string;
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

const PROBLEM_COLUMNS =
  "id, platform, contest_id, problem_index, name, rating, tags, url";

const REVIEW_COLUMNS =
  "problem_id, status, due_at, interval_days, attempts, updated_at";

const UPSERT_PROBLEM = `
  INSERT INTO problems (
    id, platform, contest_id, problem_index, name, rating, tags, url, imported_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    rating = excluded.rating,
    tags = excluded.tags,
    url = excluded.url,
    imported_at = excluded.imported_at
`;

const INSERT_SUBMISSION = `
  INSERT INTO submissions (id, platform, problem_id, verdict, submitted_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;

const INSERT_RATING = `
  INSERT INTO rating_history (
    platform, contest_id, contest_name, rank, old_rating, new_rating, rated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const SAVE_REVIEW = `
  INSERT INTO problem_reviews (problem_id, status, due_at, interval_days, attempts, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(problem_id) DO UPDATE SET
    status = excluded.status,
    due_at = excluded.due_at,
    interval_days = excluded.interval_days,
    attempts = excluded.attempts,
    updated_at = excluded.updated_at
`;

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

function rowToSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    platform: row.platform,
    problemId: row.problem_id,
    verdict: row.verdict,
    submittedAt: new Date(row.submitted_at),
  };
}

function rowToRating(row: RatingRow): RatingEntry {
  return {
    platform: row.platform,
    contestId: row.contest_id,
    contestName: row.contest_name,
    rank: row.rank,
    oldRating: row.old_rating,
    newRating: row.new_rating,
    ratedAt: new Date(row.rated_at),
  };
}

export async function getAccount(
  platform: TrainingPlatform = "codeforces"
): Promise<TrainingAccount | null> {
  await ready();

  const result = await client.execute({
    sql: "SELECT platform, handle, linked_at FROM platform_accounts WHERE platform = ?",
    args: [platform],
  });
  const row = result.rows[0] as unknown as AccountRow | undefined;

  return row
    ? {
        platform: row.platform,
        handle: row.handle,
        linkedAt: new Date(row.linked_at),
      }
    : null;
}

export async function saveAccount(
  handle: string,
  platform: TrainingPlatform = "codeforces"
): Promise<void> {
  await ready();

  await client.execute({
    sql: `INSERT INTO platform_accounts (platform, handle, linked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(platform) DO UPDATE SET
        handle = excluded.handle,
        linked_at = excluded.linked_at`,
    args: [platform, handle, new Date().toISOString()],
  });
}

export async function listProblems(
  platform: TrainingPlatform = "codeforces"
): Promise<Problem[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT ${PROBLEM_COLUMNS}
      FROM problems
      WHERE platform = ?
      ORDER BY id ASC`,
    args: [platform],
  });

  return (result.rows as unknown as ProblemRow[]).map(rowToProblem);
}

export async function listSubmissions(
  platform: TrainingPlatform = "codeforces"
): Promise<Submission[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT id, platform, problem_id, verdict, submitted_at
      FROM submissions
      WHERE platform = ?
      ORDER BY submitted_at ASC, id ASC`,
    args: [platform],
  });

  return (result.rows as unknown as SubmissionRow[]).map(rowToSubmission);
}

export async function replaceRatingHistory(
  entries: RatingEntry[],
  platform: TrainingPlatform = "codeforces"
): Promise<void> {
  await ready();

  await client.batch(
    [
      {
        sql: "DELETE FROM rating_history WHERE platform = ?",
        args: [platform],
      },
      ...entries.map((entry) => ({
        sql: INSERT_RATING,
        args: [
          entry.platform,
          entry.contestId,
          entry.contestName,
          entry.rank,
          entry.oldRating,
          entry.newRating,
          entry.ratedAt.toISOString(),
        ],
      })),
    ],
    "write"
  );
}

export async function listRatingHistory(
  platform: TrainingPlatform = "codeforces"
): Promise<RatingEntry[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT platform, contest_id, contest_name, rank, old_rating, new_rating, rated_at
      FROM rating_history
      WHERE platform = ?
      ORDER BY rated_at ASC, contest_id ASC`,
    args: [platform],
  });

  return (result.rows as unknown as RatingRow[]).map(rowToRating);
}

export async function countProblems(): Promise<number> {
  await ready();

  const result = await client.execute("SELECT COUNT(*) AS count FROM problems");

  return Number(result.rows[0]?.count ?? 0);
}

export async function countSubmissions(): Promise<number> {
  await ready();

  const result = await client.execute(
    "SELECT COUNT(*) AS count FROM submissions"
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function saveProblems(problems: Problem[]): Promise<void> {
  await ready();

  const now = new Date().toISOString();

  await client.batch(
    problems.map((problem) => ({
      sql: UPSERT_PROBLEM,
      args: [
        problem.id,
        problem.platform,
        problem.contestId,
        problem.index,
        problem.name,
        problem.rating,
        JSON.stringify(problem.tags),
        problem.url,
        now,
      ],
    })),
    "write"
  );
}

export async function replaceSubmissions(
  submissions: Submission[],
  platform: TrainingPlatform = "codeforces"
): Promise<void> {
  await ready();

  await client.batch(
    [
      {
        sql: "DELETE FROM submissions WHERE platform = ?",
        args: [platform],
      },
      ...submissions.map((submission) => ({
        sql: INSERT_SUBMISSION,
        args: [
          submission.id,
          submission.platform,
          submission.problemId,
          submission.verdict,
          submission.submittedAt.toISOString(),
        ],
      })),
    ],
    "write"
  );
}

export async function getSolvedProblemIds(
  platform: TrainingPlatform = "codeforces"
): Promise<Set<string>> {
  await ready();

  const result = await client.execute({
    sql: `SELECT DISTINCT problem_id FROM submissions
      WHERE platform = ? AND verdict = 'OK'`,
    args: [platform],
  });

  return new Set(result.rows.map((row) => String(row.problem_id)));
}

export async function getProblemsByContest(
  contestId: string,
  platform: TrainingPlatform = "codeforces"
): Promise<Problem[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT ${PROBLEM_COLUMNS}
      FROM problems
      WHERE platform = ? AND contest_id = ?
      ORDER BY problem_index ASC`,
    args: [platform, contestId],
  });

  return (result.rows as unknown as ProblemRow[]).map(rowToProblem);
}

export async function getProblem(id: string): Promise<Problem | null> {
  await ready();

  const result = await client.execute({
    sql: `SELECT ${PROBLEM_COLUMNS} FROM problems WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0] as unknown as ProblemRow | undefined;

  return row ? rowToProblem(row) : null;
}

/** Adds a due review if the problem is not tracked yet. Returns true when inserted. */
export async function ensureReview(
  problemId: string,
  now: Date = new Date()
): Promise<boolean> {
  await ready();

  const result = await client.execute({
    sql: `INSERT INTO problem_reviews (problem_id, status, due_at, interval_days, attempts, updated_at)
      VALUES (?, 'due', ?, 1, 0, ?)
      ON CONFLICT(problem_id) DO NOTHING`,
    args: [problemId, now.toISOString(), now.toISOString()],
  });

  return result.rowsAffected > 0;
}

/** Upserts a review row; used by fixtures and tests. */
export async function saveReview(review: ProblemReview): Promise<void> {
  await ready();

  await client.execute({
    sql: SAVE_REVIEW,
    args: [
      review.problemId,
      review.status,
      review.dueAt.toISOString(),
      review.intervalDays,
      review.attempts,
      review.updatedAt.toISOString(),
    ],
  });
}

export async function getReview(
  problemId: string
): Promise<ProblemReview | null> {
  await ready();

  const result = await client.execute({
    sql: `SELECT ${REVIEW_COLUMNS} FROM problem_reviews WHERE problem_id = ?`,
    args: [problemId],
  });
  const row = result.rows[0] as unknown as ReviewRow | undefined;

  return row ? rowToReview(row) : null;
}

/** Closes an active review; returns true when a row changed. */
export async function closeReview(
  problemId: string,
  now: Date = new Date()
): Promise<boolean> {
  await ready();

  const result = await client.execute({
    sql: `UPDATE problem_reviews
      SET status = 'done', updated_at = ?
      WHERE problem_id = ? AND status IN ('due', 'scheduled')`,
    args: [now.toISOString(), problemId],
  });

  return result.rowsAffected > 0;
}

export async function applyReviewAction(
  problemId: string,
  action: ReviewAction,
  now: Date = new Date()
): Promise<ProblemReview | null> {
  const review = await getReview(problemId);

  if (!review) {
    return null;
  }

  if (action === "solved" || action === "drop") {
    await client.execute({
      sql: `UPDATE problem_reviews
        SET status = ?, due_at = ?, interval_days = ?, attempts = ?, updated_at = ?
        WHERE problem_id = ?`,
      args: [
        action === "solved" ? "done" : "dropped",
        review.dueAt.toISOString(),
        review.intervalDays,
        review.attempts,
        now.toISOString(),
        problemId,
      ],
    });

    return getReview(problemId);
  }

  const intervalDays =
    REVIEW_INTERVALS[Math.min(review.attempts, REVIEW_INTERVALS.length - 1)];
  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000);

  await client.execute({
    sql: `UPDATE problem_reviews
      SET status = ?, due_at = ?, interval_days = ?, attempts = ?, updated_at = ?
      WHERE problem_id = ?`,
    args: [
      "scheduled",
      dueAt.toISOString(),
      intervalDays,
      review.attempts + 1,
      now.toISOString(),
      problemId,
    ],
  });

  return getReview(problemId);
}

export async function listReviews(): Promise<ReviewEntry[]> {
  await ready();

  const result = await client.execute(`
    SELECT
      r.problem_id, r.status, r.due_at, r.interval_days, r.attempts, r.updated_at,
      p.id, p.platform, p.contest_id, p.problem_index, p.name, p.rating, p.tags, p.url
    FROM problem_reviews r
    JOIN problems p ON p.id = r.problem_id
    ORDER BY r.due_at ASC
  `);

  return (result.rows as unknown as ReviewJoinRow[]).map(rowToReviewEntry);
}

export async function listDueReviews(
  now: Date = new Date(),
  limit = 5
): Promise<ReviewEntry[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT
      r.problem_id, r.status, r.due_at, r.interval_days, r.attempts, r.updated_at,
      p.id, p.platform, p.contest_id, p.problem_index, p.name, p.rating, p.tags, p.url
    FROM problem_reviews r
    JOIN problems p ON p.id = r.problem_id
    WHERE r.status IN ('due', 'scheduled') AND r.due_at <= ?
    ORDER BY r.due_at ASC
    LIMIT ?`,
    args: [now.toISOString(), limit],
  });

  return (result.rows as unknown as ReviewJoinRow[]).map(rowToReviewEntry);
}

export async function getReviewCounts(
  now: Date = new Date()
): Promise<{ due: number; upcoming: number; done: number }> {
  await ready();

  const result = await client.execute({
    sql: `SELECT
      SUM(CASE WHEN status IN ('due', 'scheduled') AND due_at <= ? THEN 1 ELSE 0 END) AS due,
      SUM(CASE WHEN status IN ('due', 'scheduled') AND due_at >  ? THEN 1 ELSE 0 END) AS upcoming,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM problem_reviews`,
    args: [now.toISOString(), now.toISOString()],
  });
  const row = result.rows[0] as
    | { due: number | null; upcoming: number | null; done: number | null }
    | undefined;

  return {
    due: Number(row?.due ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    done: Number(row?.done ?? 0),
  };
}

export async function setTrainingState(
  key: string,
  value: string
): Promise<void> {
  await ready();

  await client.execute({
    sql: `INSERT INTO training_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

export async function getTrainingState(key: string): Promise<string | null> {
  await ready();

  const result = await client.execute({
    sql: "SELECT value FROM training_state WHERE key = ?",
    args: [key],
  });

  return (result.rows[0]?.value as string | undefined) ?? null;
}

/** Contests marked participated whose start time has passed. */
export async function getAttendedContests(): Promise<Contest[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT c.id, c.platform, c.name, c.start_time, c.duration_seconds, c.url
      FROM contests c
      JOIN participation p ON p.contest_id = c.id
      WHERE p.status = 'participated' AND c.start_time < ?
      ORDER BY c.start_time DESC`,
    args: [new Date().toISOString()],
  });

  return (
    result.rows as unknown as {
      id: string;
      platform: Contest["platform"];
      name: string;
      start_time: string;
      duration_seconds: number;
      url: string;
    }[]
  ).map((row) => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
  }));
}
