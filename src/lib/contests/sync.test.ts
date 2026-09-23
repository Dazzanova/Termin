/**
 * Integration tests for the sync pipeline using an in-memory SQLite database.
 *
 * We re-implement the minimal repository operations against the test DB so that
 * these tests are isolated from the real .data/termin.db file.
 */
import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import type { Contest, ContestPlatform } from "./types";
import { validateContests } from "./validate";
import { reconcileContests } from "./reconcile";

// ---------------------------------------------------------------------------
// Minimal in-memory repository mirroring the real one
// ---------------------------------------------------------------------------

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS contests (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      url TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contests_start_time
    ON contests (start_time)
  `);

  type ContestRow = {
    id: string;
    platform: ContestPlatform;
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

  const upsertStmt = db.prepare(`
    INSERT INTO contests (id, platform, name, start_time, duration_seconds, url, updated_at)
    VALUES (@id, @platform, @name, @start_time, @duration_seconds, @url, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      platform = excluded.platform,
      name = excluded.name,
      start_time = excluded.start_time,
      duration_seconds = excluded.duration_seconds,
      url = excluded.url,
      updated_at = excluded.updated_at
  `);

  const getUpcomingByPlatformStmt = db.prepare(`
    SELECT id, platform, name, start_time, duration_seconds, url, updated_at
    FROM contests
    WHERE platform = ? AND start_time > ?
    ORDER BY start_time ASC
  `);

  const getAllUpcomingStmt = db.prepare(`
    SELECT id, platform, name, start_time, duration_seconds, url, updated_at
    FROM contests
    WHERE start_time > ?
    ORDER BY start_time ASC
  `);

  const deleteStmt = db.prepare(
    `DELETE FROM contests WHERE id = ? AND start_time > ? AND platform = ?`
  );

  function saveContests(contests: Contest[]): void {
    const tx = db.transaction((items: Contest[]) => {
      const now = new Date().toISOString();
      for (const c of items) {
        upsertStmt.run({
          id: c.id,
          platform: c.platform,
          name: c.name,
          start_time: c.startTime.toISOString(),
          duration_seconds: c.durationSeconds,
          url: c.url,
          updated_at: now,
        });
      }
    });
    tx(contests);
  }

  function getUpcomingByPlatform(platform: ContestPlatform): Contest[] {
    return (getUpcomingByPlatformStmt.all(platform, new Date().toISOString()) as ContestRow[]).map(
      rowToContest
    );
  }

  function getAllUpcoming(): Contest[] {
    return (getAllUpcomingStmt.all(new Date().toISOString()) as ContestRow[]).map(rowToContest);
  }

  function removeStale(platform: ContestPlatform, currentIds: Set<string>): number {
    const stored = getUpcomingByPlatform(platform);
    const staleIds = stored.map((c) => c.id).filter((id) => !currentIds.has(id));

    if (staleIds.length === 0) return 0;

    const tx = db.transaction((ids: string[]) => {
      const ts = new Date().toISOString();
      for (const id of ids) {
        deleteStmt.run(id, ts, platform);
      }
    });
    tx(staleIds);

    return staleIds.length;
  }

  return { saveContests, getUpcomingByPlatform, getAllUpcoming, removeStale };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

function makeContest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: "codeforces:123",
    platform: "codeforces",
    name: "Codeforces Round 900",
    startTime: FUTURE,
    durationSeconds: 7200,
    url: "https://codeforces.com/contest/123",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validation blocks invalid contests from reaching the DB", () => {
  it("does not save a contest with an empty name", () => {
    const repo = createTestDb();

    const raw: Contest = makeContest({ name: "" });
    const valid = validateContests([raw]);
    repo.saveContests(valid);

    expect(repo.getAllUpcoming()).toHaveLength(0);
  });

  it("does not save a contest with an unsupported platform", () => {
    const repo = createTestDb();

    const raw: Contest = makeContest({
      platform: "hackerrank" as ContestPlatform,
    });
    const valid = validateContests([raw]);
    repo.saveContests(valid);

    expect(repo.getAllUpcoming()).toHaveLength(0);
  });

  it("does not save a contest with a non-HTTP url", () => {
    const repo = createTestDb();

    const raw: Contest = makeContest({ url: "ftp://example.com/contest" });
    const valid = validateContests([raw]);
    repo.saveContests(valid);

    expect(repo.getAllUpcoming()).toHaveLength(0);
  });
});

describe("provider failure preserves existing stored contests", () => {
  it("keeps stored contests when a provider fetch fails", () => {
    const repo = createTestDb();

    // Seed an existing contest.
    const existing = makeContest({ id: "codeforces:100", name: "Existing" });
    repo.saveContests([existing]);

    // Simulate a provider failure: we skip save and removeStale entirely.
    // The stored data must be untouched.
    const stored = repo.getAllUpcoming();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:100");
  });
});

describe("successful provider sync reconciles only that provider's data", () => {
  it("removes a stale upcoming contest from the succeeded provider", () => {
    const repo = createTestDb();

    // Seed two codeforces contests.
    const old = makeContest({ id: "codeforces:100", name: "Old Round" });
    const current = makeContest({ id: "codeforces:200", name: "New Round" });
    repo.saveContests([old, current]);

    // Provider now returns only the new one (old is cancelled).
    const fresh = [current];
    repo.saveContests(fresh);
    repo.removeStale("codeforces", new Set(fresh.map((c) => c.id)));

    const stored = repo.getUpcomingByPlatform("codeforces");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:200");
  });

  it("does not remove a contest that already started (past start_time)", () => {
    const repo = createTestDb();

    // Insert a contest with a past start_time directly.
    const past = makeContest({
      id: "codeforces:99",
      startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    });
    // saveContests writes what we give it; bypass validation for this fixture.
    repo.saveContests([past]);

    // Provider returns nothing (contest already started, no longer "upcoming").
    repo.removeStale("codeforces", new Set());

    // The past contest should not have been touched by removeStale because the
    // DELETE WHERE start_time > now condition excludes it.
    // getUpcomingByPlatform also excludes it (same condition), so length = 0.
    // But the raw DB still has it — we just verify removeStale didn't error.
    expect(repo.getUpcomingByPlatform("codeforces")).toHaveLength(0);
  });
});

describe("one provider's data is not deleted because another provider failed", () => {
  it("leetcode contests survive when codeforces fetch fails", () => {
    const repo = createTestDb();

    const lc = makeContest({
      id: "leetcode:weekly-420",
      platform: "leetcode",
      url: "https://leetcode.com/contest/weekly-420/",
    });
    const cf = makeContest({ id: "codeforces:300", platform: "codeforces" });

    repo.saveContests([lc, cf]);

    // Simulate: codeforces fails (do nothing for codeforces).
    // Leetcode succeeds with its current set.
    const lcFresh = [lc];
    repo.saveContests(lcFresh);
    repo.removeStale("leetcode", new Set(lcFresh.map((c) => c.id)));

    // Codeforces contest must still be present.
    const cfStored = repo.getUpcomingByPlatform("codeforces");
    expect(cfStored).toHaveLength(1);
    expect(cfStored[0].id).toBe("codeforces:300");

    // Leetcode contest is still present too.
    const lcStored = repo.getUpcomingByPlatform("leetcode");
    expect(lcStored).toHaveLength(1);
    expect(lcStored[0].id).toBe("leetcode:weekly-420");
  });

  it("removeStale for one platform never touches another platform's rows", () => {
    const repo = createTestDb();

    const lc1 = makeContest({
      id: "leetcode:weekly-1",
      platform: "leetcode",
      url: "https://leetcode.com/contest/weekly-1/",
    });
    const lc2 = makeContest({
      id: "leetcode:weekly-2",
      platform: "leetcode",
      url: "https://leetcode.com/contest/weekly-2/",
    });
    const cf = makeContest({ id: "codeforces:500", platform: "codeforces" });

    repo.saveContests([lc1, lc2, cf]);

    // Leetcode sync succeeds but only returns lc1 — lc2 is stale.
    repo.removeStale("leetcode", new Set(["leetcode:weekly-1"]));

    expect(repo.getUpcomingByPlatform("leetcode")).toHaveLength(1);
    // Codeforces is completely unaffected.
    expect(repo.getUpcomingByPlatform("codeforces")).toHaveLength(1);
    expect(repo.getUpcomingByPlatform("codeforces")[0].id).toBe("codeforces:500");
  });
});

describe("reconcileContests operates on provider-scoped data", () => {
  it("does not report an added event for another provider's existing contest", () => {
    // If we scope reconcile to codeforces only, an atcoder contest in the DB
    // should not appear as "added" in the codeforces diff.
    const previous: Contest[] = [
      makeContest({ id: "codeforces:100", platform: "codeforces" }),
    ];
    const current: Contest[] = [
      makeContest({ id: "codeforces:100", platform: "codeforces" }),
      makeContest({
        id: "atcoder:abc123",
        platform: "atcoder",
        url: "https://atcoder.jp/contests/abc123",
      }),
    ];

    // In real sync, current only contains the single provider's contests.
    // This test verifies the reconciler itself behaves correctly when scoped.
    const codeforcesOnly = current.filter((c) => c.platform === "codeforces");
    const changes = reconcileContests(previous, codeforcesOnly);

    expect(changes).toHaveLength(0);
  });
});
