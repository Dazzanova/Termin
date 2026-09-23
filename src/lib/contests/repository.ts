import db from "../db/database";
import type { Contest, ContestPlatform } from "./types";

type ContestRow = {
  id: string;
  platform: Contest["platform"];
  name: string;
  start_time: string;
  duration_seconds: number;
  url: string;
  updated_at: string;
};

function rowToContest(row: ContestRow): Contest {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
  };
}

const getContestsStatement = db.prepare(`
  SELECT
    id,
    platform,
    name,
    start_time,
    duration_seconds,
    url,
    updated_at
  FROM contests
`);

const upsertContestStatement = db.prepare(`
  INSERT INTO contests (
    id,
    platform,
    name,
    start_time,
    duration_seconds,
    url,
    updated_at
  )
  VALUES (
    @id,
    @platform,
    @name,
    @start_time,
    @duration_seconds,
    @url,
    @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    platform = excluded.platform,
    name = excluded.name,
    start_time = excluded.start_time,
    duration_seconds = excluded.duration_seconds,
    url = excluded.url,
    updated_at = excluded.updated_at
`);

const getUpcomingContestsStatement = db.prepare(`
  SELECT
    id,
    platform,
    name,
    start_time,
    duration_seconds,
    url,
    updated_at
  FROM contests
  WHERE start_time > ?
  ORDER BY start_time ASC
`);

const getUpcomingContestsByPlatformStatement = db.prepare(`
  SELECT
    id,
    platform,
    name,
    start_time,
    duration_seconds,
    url,
    updated_at
  FROM contests
  WHERE platform = ? AND start_time > ?
  ORDER BY start_time ASC
`);

export function getStoredContests(): Contest[] {
  const rows = getContestsStatement.all() as ContestRow[];
  return rows.map(rowToContest);
}

export function getUpcomingStoredContests(): Contest[] {
  const rows = getUpcomingContestsStatement.all(
    new Date().toISOString()
  ) as ContestRow[];
  return rows.map(rowToContest);
}

export function getUpcomingStoredContestsByPlatform(
  platform: ContestPlatform
): Contest[] {
  const rows = getUpcomingContestsByPlatformStatement.all(
    platform,
    new Date().toISOString()
  ) as ContestRow[];
  return rows.map(rowToContest);
}

export function saveContests(contests: Contest[]): void {
  const transaction = db.transaction((items: Contest[]) => {
    const now = new Date().toISOString();

    for (const contest of items) {
      upsertContestStatement.run({
        id: contest.id,
        platform: contest.platform,
        name: contest.name,
        start_time: contest.startTime.toISOString(),
        duration_seconds: contest.durationSeconds,
        url: contest.url,
        updated_at: now,
      });
    }
  });

  transaction(contests);
}

/**
 * Removes upcoming contests for a platform that are absent from the provider's
 * current response. Only called when a provider fetch succeeded — never on
 * failure. Only contests with a future start_time are considered, so naturally-
 * elapsed contests are never deleted.
 */
export function removeStaleUpcomingContests(
  platform: ContestPlatform,
  currentIds: Set<string>
): number {
  const now = new Date().toISOString();

  const stored = getUpcomingContestsByPlatformStatement.all(
    platform,
    now
  ) as ContestRow[];

  const staleIds = stored
    .map((row) => row.id)
    .filter((id) => !currentIds.has(id));

  if (staleIds.length === 0) {
    return 0;
  }

  // Build the DELETE in a transaction with individual bound parameters so we
  // stay compatible with better-sqlite3 (no array binding support).
  const deleteStmt = db.prepare(
    `DELETE FROM contests WHERE id = ? AND start_time > ? AND platform = ?`
  );

  const deleteMany = db.transaction((ids: string[]) => {
    const ts = new Date().toISOString();
    for (const id of ids) {
      deleteStmt.run(id, ts, platform);
    }
  });

  deleteMany(staleIds);

  return staleIds.length;
}
