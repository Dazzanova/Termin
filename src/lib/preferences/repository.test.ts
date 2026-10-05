import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import type { Contest } from "../contests/types";

vi.mock("../db/database", async () => {
  const { default: Database } = await import("better-sqlite3");

  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled_platforms TEXT NOT NULL
    )
  `);

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

  return {
    default: db,
  };
});

import db from "../db/database";
import {
  DEFAULT_PREFERENCES,
  SUPPORTED_PLATFORMS,
} from "./types";
import {
  getPreferences,
  savePreferences,
} from "./repository";
import {
  getUpcomingStoredContests,
  saveContests,
} from "../contests/repository";
import { getUpcomingContests } from "../contests/getUpcomingContests";

function makeContest(overrides: Partial<Contest> = {}): Contest {
  const future = new Date(Date.now() + 86_400_000);
  return {
    id: "contest-1",
    platform: "codeforces",
    name: "Sample Contest",
    startTime: future,
    durationSeconds: 7200,
    url: "https://codeforces.com/contest/1",
    ...overrides,
  };
}

beforeEach(() => {
  db.exec("DELETE FROM preferences");
  db.exec("DELETE FROM contests");
});

describe("preferences repository", () => {
  it("initializes first-run defaults when no preferences exist", () => {
    const preferences = getPreferences();

    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
    expect(preferences.enabledPlatforms).toEqual([
      "codeforces",
      "atcoder",
      "codechef",
      "leetcode",
    ]);

    // Verify it was persisted to SQLite
    const row = db
      .prepare("SELECT * FROM preferences WHERE id = 1")
      .get() as { id: number; enabled_platforms: string };

    expect(row).toBeDefined();
    expect(row.id).toBe(1);
    expect(JSON.parse(row.enabled_platforms)).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("saves and loads preferences", () => {
    savePreferences({
      enabledPlatforms: ["codeforces", "leetcode"],
    });

    const preferences = getPreferences();
    expect(preferences.enabledPlatforms).toEqual([
      "codeforces",
      "leetcode",
    ]);
  });

  it("persists preferences across repository calls", () => {
    savePreferences({
      enabledPlatforms: ["atcoder"],
    });

    const firstCall = getPreferences();
    const secondCall = getPreferences();

    expect(firstCall.enabledPlatforms).toEqual(["atcoder"]);
    expect(secondCall.enabledPlatforms).toEqual(["atcoder"]);

    // Verify exact value in SQLite table
    const row = db
      .prepare("SELECT enabled_platforms FROM preferences WHERE id = 1")
      .get() as { enabled_platforms: string };
    expect(JSON.parse(row.enabled_platforms)).toEqual(["atcoder"]);
  });

  it("handles invalid/unsupported stored platform data safely", () => {
    // Inject row with unsupported platforms and non-string elements
    db.prepare(`
      INSERT INTO preferences (id, enabled_platforms)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET enabled_platforms = excluded.enabled_platforms
    `).run(JSON.stringify(["codeforces", "unsupported_platform", 123, null]));

    const preferences = getPreferences();
    // Unsupported platforms and non-strings must be filtered out
    expect(preferences.enabledPlatforms).toEqual(["codeforces"]);
  });

  it("handles malformed JSON in stored preferences safely", () => {
    db.prepare(`
      INSERT INTO preferences (id, enabled_platforms)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET enabled_platforms = excluded.enabled_platforms
    `).run("{ malformed json");

    const preferences = getPreferences();
    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("handles non-array stored data safely", () => {
    db.prepare(`
      INSERT INTO preferences (id, enabled_platforms)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET enabled_platforms = excluded.enabled_platforms
    `).run(JSON.stringify({ not: "an array" }));

    const preferences = getPreferences();
    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("sanitizes unsupported platforms on save", () => {
    savePreferences({
      enabledPlatforms: [
        "codeforces",
        "fake_platform" as any,
        "codeforces", // duplicate
      ],
    });

    const preferences = getPreferences();
    expect(preferences.enabledPlatforms).toEqual(["codeforces"]);
  });
});

describe("platform filtering", () => {
  beforeEach(() => {
    const future = new Date(Date.now() + 86_400_000);
    saveContests([
      makeContest({
        id: "cf-1",
        platform: "codeforces",
        name: "Codeforces Round 1",
        startTime: future,
      }),
      makeContest({
        id: "ac-1",
        platform: "atcoder",
        name: "AtCoder Beginner Contest",
        startTime: new Date(future.getTime() + 1000),
      }),
      makeContest({
        id: "cc-1",
        platform: "codechef",
        name: "CodeChef Starters",
        startTime: new Date(future.getTime() + 2000),
      }),
      makeContest({
        id: "lc-1",
        platform: "leetcode",
        name: "LeetCode Weekly Contest",
        startTime: new Date(future.getTime() + 3000),
      }),
    ]);
  });

  it("returns all contests when default preferences are active", () => {
    const contests = getUpcomingContests();
    expect(contests).toHaveLength(4);
  });

  it("filters upcoming contests to one platform", () => {
    savePreferences({
      enabledPlatforms: ["codeforces"],
    });

    const contests = getUpcomingContests();
    expect(contests).toHaveLength(1);
    expect(contests[0].platform).toBe("codeforces");
    expect(contests[0].id).toBe("cf-1");
  });

  it("filters upcoming contests to multiple platforms", () => {
    savePreferences({
      enabledPlatforms: ["codeforces", "atcoder"],
    });

    const contests = getUpcomingContests();
    expect(contests).toHaveLength(2);
    const platforms = contests.map((c) => c.platform);
    expect(platforms).toEqual(["codeforces", "atcoder"]);
  });

  it("returns no contests when empty platform selection is saved", () => {
    savePreferences({
      enabledPlatforms: [],
    });

    const preferences = getPreferences();
    expect(preferences.enabledPlatforms).toEqual([]);

    const contests = getUpcomingContests();
    expect(contests).toHaveLength(0);
  });

  it("filters directly in getUpcomingStoredContests repository call", () => {
    const cfContests = getUpcomingStoredContests(["codeforces"]);
    expect(cfContests).toHaveLength(1);
    expect(cfContests[0].platform).toBe("codeforces");

    const multiContests = getUpcomingStoredContests(["codechef", "leetcode"]);
    expect(multiContests).toHaveLength(2);
    expect(multiContests.map((c) => c.platform)).toEqual(["codechef", "leetcode"]);

    const emptyContests = getUpcomingStoredContests([]);
    expect(emptyContests).toHaveLength(0);

    const allContests = getUpcomingStoredContests();
    expect(allContests).toHaveLength(4);
  });
});
