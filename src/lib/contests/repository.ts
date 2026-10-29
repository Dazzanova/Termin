import { client, ready } from "../db/database";
import type { Contest, ContestPlatform, ParticipationStatus } from "./types";

type ContestRow = {
  id: string;
  platform: Contest["platform"];
  name: string;
  start_time: string;
  duration_seconds: number;
  url: string;
  updated_at: string;
};

type ParticipationRow = {
  contest_id: string;
  status: ParticipationStatus;
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

const CONTEST_COLUMNS = `
  id,
  platform,
  name,
  start_time,
  duration_seconds,
  url,
  updated_at
`;

const UPSERT_CONTEST = `
  INSERT INTO contests (
    id,
    platform,
    name,
    start_time,
    duration_seconds,
    url,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    platform = excluded.platform,
    name = excluded.name,
    start_time = excluded.start_time,
    duration_seconds = excluded.duration_seconds,
    url = excluded.url,
    updated_at = excluded.updated_at
`;

function upsertArgs(contest: Contest, updatedAt: string) {
  return [
    contest.id,
    contest.platform,
    contest.name,
    contest.startTime.toISOString(),
    contest.durationSeconds,
    contest.url,
    updatedAt,
  ];
}

export async function getUpcomingStoredContests(
  platforms?: ContestPlatform[]
): Promise<Contest[]> {
  await ready();

  const now = new Date().toISOString();

  if (platforms !== undefined) {
    if (platforms.length === 0) {
      return [];
    }

    const placeholders = platforms.map(() => "?").join(", ");
    const result = await client.execute({
      sql: `SELECT ${CONTEST_COLUMNS}
        FROM contests
        WHERE start_time > ?
          AND platform IN (${placeholders})
        ORDER BY start_time ASC`,
      args: [now, ...platforms],
    });

    return (result.rows as unknown as ContestRow[]).map(rowToContest);
  }

  const result = await client.execute({
    sql: `SELECT ${CONTEST_COLUMNS}
      FROM contests
      WHERE start_time > ?
      ORDER BY start_time ASC`,
    args: [now],
  });

  return (result.rows as unknown as ContestRow[]).map(rowToContest);
}

export async function getUpcomingStoredContestsByPlatform(
  platform: ContestPlatform
): Promise<Contest[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT ${CONTEST_COLUMNS}
      FROM contests
      WHERE platform = ? AND start_time > ?
      ORDER BY start_time ASC`,
    args: [platform, new Date().toISOString()],
  });

  return (result.rows as unknown as ContestRow[]).map(rowToContest);
}

export async function saveContests(contests: Contest[]): Promise<void> {
  await ready();

  const now = new Date().toISOString();

  await client.batch(
    contests.map((contest) => ({
      sql: UPSERT_CONTEST,
      args: upsertArgs(contest, now),
    })),
    "write"
  );
}

export async function syncProviderContests(
  platform: ContestPlatform,
  contests: Contest[]
): Promise<number> {
  await ready();

  const currentIds = new Set(contests.map((contest) => contest.id));
  const now = new Date().toISOString();

  const transaction = await client.transaction("write");

  try {
    for (const contest of contests) {
      await transaction.execute({
        sql: UPSERT_CONTEST,
        args: upsertArgs(contest, now),
      });
    }

    const storedResult = await transaction.execute({
      sql: `SELECT ${CONTEST_COLUMNS}
        FROM contests
        WHERE platform = ? AND start_time > ?
        ORDER BY start_time ASC`,
      args: [platform, now],
    });
    const stored = storedResult.rows as unknown as ContestRow[];

    const staleIds = stored
      .map((row) => row.id)
      .filter((id) => !currentIds.has(id));

    for (const id of staleIds) {
      const participation = await transaction.execute({
        sql: "SELECT status FROM participation WHERE contest_id = ?",
        args: [id],
      });

      if (participation.rows.length === 0) {
        await transaction.execute({
          sql: `DELETE FROM contests
            WHERE id = ?
              AND start_time > ?
              AND platform = ?`,
          args: [id, now, platform],
        });
      }
    }

    await transaction.commit();

    return staleIds.length;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getParticipationStatus(
  contestId: string
): Promise<ParticipationStatus | null> {
  await ready();

  const result = await client.execute({
    sql: "SELECT status FROM participation WHERE contest_id = ?",
    args: [contestId],
  });
  const row = result.rows[0] as unknown as ParticipationRow | undefined;

  return row ? row.status : null;
}

/** Every contest currently marked as planned, in one query. */
export async function listPlannedContestIds(): Promise<Set<string>> {
  await ready();

  const result = await client.execute(
    "SELECT contest_id FROM participation WHERE status = 'planned'"
  );

  return new Set(result.rows.map((row) => String(row.contest_id)));
}

export async function saveParticipationStatus(
  contestId: string,
  status: ParticipationStatus | null
): Promise<void> {
  await ready();

  if (status === null) {
    await client.execute({
      sql: "DELETE FROM participation WHERE contest_id = ?",
      args: [contestId],
    });
    return;
  }

  await client.execute({
    sql: `INSERT INTO participation (contest_id, status, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(contest_id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at`,
    args: [contestId, status, new Date().toISOString()],
  });
}

export type HistoryEntry = Contest & { status: ParticipationStatus };

export async function getContestHistory(
  status?: ParticipationStatus
): Promise<HistoryEntry[]> {
  await ready();

  const now = new Date().toISOString();
  const result = status
    ? await client.execute({
        sql: `SELECT
          c.id,
          c.platform,
          c.name,
          c.start_time,
          c.duration_seconds,
          c.url,
          p.status
        FROM contests c
        JOIN participation p ON c.id = p.contest_id
        WHERE c.start_time < ? AND p.status = ?
        ORDER BY c.start_time DESC`,
        args: [now, status],
      })
    : await client.execute({
        sql: `SELECT
          c.id,
          c.platform,
          c.name,
          c.start_time,
          c.duration_seconds,
          c.url,
          p.status
        FROM contests c
        JOIN participation p ON c.id = p.contest_id
        WHERE c.start_time < ?
        ORDER BY c.start_time DESC`,
        args: [now],
      });

  return (
    result.rows as unknown as (ContestRow & { status: ParticipationStatus })[]
  ).map((row) => ({
    ...rowToContest(row),
    status: row.status,
  }));
}
