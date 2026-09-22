import db from "../db/database";
import type { Contest } from "./types";

type ContestRow = {
  id: string;
  platform: Contest["platform"];
  name: string;
  start_time: string;
  duration_seconds: number;
  url: string;
  updated_at: string;
};

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

export function getStoredContests(): Contest[] {
  const rows = getContestsStatement.all() as ContestRow[];

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
  }));
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

export function getUpcomingStoredContests(): Contest[] {
  const rows = getUpcomingContestsStatement.all(
    new Date().toISOString()
  ) as ContestRow[];

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
  }));
}
