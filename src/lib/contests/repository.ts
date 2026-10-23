import db from "../db/database";
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

const getParticipationStatement = db.prepare(`
  SELECT status FROM participation WHERE contest_id = ?
`);

const saveParticipationStatement = db.prepare(`
  INSERT INTO participation (contest_id, status, updated_at)
  VALUES (@contest_id, @status, @updated_at)
  ON CONFLICT(contest_id) DO UPDATE SET
    status = excluded.status,
    updated_at = excluded.updated_at
`);

const deleteParticipationStatement = db.prepare(`
  DELETE FROM participation WHERE contest_id = ?
`);

const getHistoryStatement = db.prepare(`
  SELECT
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
  ORDER BY c.start_time DESC
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

const deleteContestStatement = db.prepare(`
  DELETE FROM contests
  WHERE id = ?
    AND start_time > ?
    AND platform = ?
`);

// Priority storage
const getPrioritizedIdsStatement = db.prepare(`
  SELECT contest_id FROM contest_priorities
`);

const savePriorityStatement = db.prepare(`
  INSERT INTO contest_priorities (contest_id, prioritized_at)
  VALUES (?, ?)
`);

const deletePriorityStatement = db.prepare(`
  DELETE FROM contest_priorities WHERE contest_id = ?
`);

export function getStoredContests(): Contest[] {
  const rows = getContestsStatement.all() as ContestRow[];

  return rows.map(rowToContest);
}

export function getUpcomingStoredContests(
  platforms?: ContestPlatform[]
): Contest[] {
  const now = new Date().toISOString();

  if (platforms !== undefined) {
    if (platforms.length === 0) {
      return [];
    }

    const placeholders = platforms.map(() => "?").join(", ");
    const stmt = db.prepare(`
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
        AND platform IN (${placeholders})
      ORDER BY start_time ASC
    `);

    const rows = stmt.all(now, ...platforms) as ContestRow[];

    return rows.map(rowToContest);
  }

  const rows = getUpcomingContestsStatement.all(now) as ContestRow[];

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
    .filter((id) => {
      if (!currentIds.has(id)) {
        // Do not remove if the user has recorded participation
        const participation = getParticipationStatement.get(id) as ParticipationRow | undefined;
        return !participation;
      }
      return false;
    });

  if (staleIds.length === 0) {
    return 0;
  }

  const deleteMany = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteContestStatement.run(id, now, platform);
    }
  });

  deleteMany(staleIds);

  return staleIds.length;
}

export function syncProviderContests(
  platform: ContestPlatform,
  contests: Contest[]
): number {
  const currentIds = new Set(
    contests.map((contest) => contest.id)
  );

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();

    for (const contest of contests) {
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

    const stored = getUpcomingContestsByPlatformStatement.all(
      platform,
      now
    ) as ContestRow[];

    const staleIds = stored
      .map((row) => row.id)
      .filter((id) => !currentIds.has(id));

    for (const id of staleIds) {
      const participation = getParticipationStatement.get(id) as ParticipationRow | undefined;
      if (!participation) {
        deleteContestStatement.run(
          id,
          now,
          platform
        );
      }
    }

    return staleIds.length;
  });

  return transaction();
}

export function getParticipationStatus(contestId: string): ParticipationStatus | null {
  const row = getParticipationStatement.get(contestId) as ParticipationRow | undefined;
  return row ? row.status : null;
}

export function saveParticipationStatus(
  contestId: string,
  status: ParticipationStatus | null
): void {
  if (status === null) {
    deleteParticipationStatement.run(contestId);
    return;
  }
  saveParticipationStatement.run({
    contest_id: contestId,
    status,
    updated_at: new Date().toISOString(),
  });
}

export type HistoryEntry = Contest & { status: ParticipationStatus };

export function getContestHistory(
  status?: ParticipationStatus
): HistoryEntry[] {
  const now = new Date().toISOString();
  let rows: any[];

  if (status) {
    const stmt = db.prepare(`
      SELECT
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
      ORDER BY c.start_time DESC
    `);
    rows = stmt.all(now, status);
  } else {
    rows = getHistoryStatement.all(now);
  }

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    startTime: new Date(row.start_time),
    durationSeconds: row.duration_seconds,
    url: row.url,
    status: row.status,
  }));
}

export function getPrioritizedContestIds(): Set<string> {
  const rows = getPrioritizedIdsStatement.all() as { contest_id: string }[];
  return new Set(rows.map(row => row.contest_id));
}

export function toggleContestPriority(contestId: string, isPrioritized: boolean): void {
  if (isPrioritized) {
    savePriorityStatement.run(contestId, new Date().toISOString());
  } else {
    deletePriorityStatement.run(contestId);
  }
}
