import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import type { Contest } from "./types";
import db from "../db/database";
import { scheduleReminders } from "../reminders/schedule";

vi.mock("../reminders/schedule", () => ({
  scheduleReminders: vi.fn(),
}));

vi.mock("../db/database", async () => {
  const { default: Database } = await import("better-sqlite3");

  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE contests (
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
    CREATE INDEX idx_contests_start_time
    ON contests (start_time)
  `);

  return {
    default: db,
  };
});

vi.mock("./providers/codeforces", () => ({
  getCodeforcesContests: vi.fn(),
}));

vi.mock("./providers/atcoder", () => ({
  getAtCoderContests: vi.fn(),
}));

vi.mock("./providers/codechef", () => ({
  getCodeChefContests: vi.fn(),
}));

vi.mock("./providers/leetcode", () => ({
  getLeetCodeContests: vi.fn(),
}));

vi.mock("./sync-state", () => ({
  markProviderFailure: vi.fn(),
  markProviderSuccess: vi.fn(),
  markSyncCompleted: vi.fn(),
  markSyncStarted: vi.fn(),
}));

import { syncContests } from "./sync";
import {
  getUpcomingStoredContestsByPlatform,
  saveContests,
} from "./repository";
import { getCodeforcesContests } from "./providers/codeforces";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeChefContests } from "./providers/codechef";
import { getLeetCodeContests } from "./providers/leetcode";

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function makeContest(
  overrides: Partial<Contest> = {}
): Contest {
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

const mockedCodeforces = vi.mocked(getCodeforcesContests);
const mockedAtCoder = vi.mocked(getAtCoderContests);
const mockedCodeChef = vi.mocked(getCodeChefContests);
const mockedLeetCode = vi.mocked(getLeetCodeContests);
const mockedScheduleReminders =
  vi.mocked(scheduleReminders);

beforeEach(() => {
  db.exec("DELETE FROM contests");

  vi.clearAllMocks();

  mockedCodeforces.mockResolvedValue([]);
  mockedAtCoder.mockResolvedValue([]);
  mockedCodeChef.mockResolvedValue([]);
  mockedLeetCode.mockResolvedValue([]);
});

describe("syncContests", () => {
  it("saves contests returned by a successful provider", async () => {
    const contest = makeContest();

    mockedCodeforces.mockResolvedValue([contest]);

    const result = await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(contest.id);
    expect(result.contests).toHaveLength(1);
    expect(result.failedProviders).toHaveLength(0);
  });

  it("schedules reminders for contests returned by a successful provider", async () => {
    const contest = makeContest();

    mockedCodeforces.mockResolvedValue([contest]);

    await syncContests();

    expect(mockedScheduleReminders).toHaveBeenCalledTimes(1);
    expect(mockedScheduleReminders).toHaveBeenCalledWith(
      contest
    );
  });

  it("updates an existing contest when its data changes", async () => {
    const original = makeContest({
      id: "codeforces:123",
      name: "Original Name",
    });

    const updated = makeContest({
      id: "codeforces:123",
      name: "Updated Name",
    });

    saveContests([original]);

    mockedCodeforces.mockResolvedValue([updated]);

    await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Updated Name");
  });

  it("removes stale contests from a successfully synced provider", async () => {
    const stale = makeContest({
      id: "codeforces:100",
      name: "Cancelled Contest",
    });

    const current = makeContest({
      id: "codeforces:200",
      name: "Current Contest",
    });

    saveContests([stale]);

    mockedCodeforces.mockResolvedValue([current]);

    await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:200");
  });

  it("does not remove another provider's contests", async () => {
    const codeforcesContest = makeContest({
      id: "codeforces:100",
      platform: "codeforces",
    });

    const atcoderContest = makeContest({
      id: "atcoder:abc123",
      platform: "atcoder",
      url: "https://atcoder.jp/contests/abc123",
    });

    saveContests([
      codeforcesContest,
      atcoderContest,
    ]);

    mockedCodeforces.mockResolvedValue([
      codeforcesContest,
    ]);

    mockedAtCoder.mockResolvedValue([
      atcoderContest,
    ]);

    await syncContests();

    const atcoderStored =
      getUpcomingStoredContestsByPlatform("atcoder");

    expect(atcoderStored).toHaveLength(1);
    expect(atcoderStored[0].id).toBe("atcoder:abc123");
  });

  it("preserves existing contests when a provider fails", async () => {
    const existing = makeContest({
      id: "codeforces:100",
      name: "Existing Contest",
    });

    saveContests([existing]);

    mockedCodeforces.mockRejectedValue(
      new Error("Codeforces unavailable")
    );

    const result = await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:100");
    expect(result.failedProviders).toContain("codeforces");
  });

  it("does not schedule reminders when a provider fails", async () => {
    mockedCodeforces.mockRejectedValue(
      new Error("Codeforces unavailable")
    );

    await syncContests();

    expect(mockedScheduleReminders).not.toHaveBeenCalled();
  });

  it("preserves existing contests when a provider returns invalid data", async () => {
    const existing = makeContest({
      id: "codeforces:100",
      name: "Existing Contest",
    });

    saveContests([existing]);

    const invalid = makeContest({
      id: "",
      name: "Invalid Contest",
    });

    mockedCodeforces.mockResolvedValue([invalid]);

    await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:100");
  });

  it("does not schedule reminders for invalid provider data", async () => {
    const invalid = makeContest({
      id: "",
    });

    mockedCodeforces.mockResolvedValue([invalid]);

    await syncContests();

    expect(mockedScheduleReminders).not.toHaveBeenCalled();
  });

  it("rejects a contest whose platform does not match its provider", async () => {
    const invalid = makeContest({
      id: "atcoder:abc123",
      platform: "atcoder",
      url: "https://atcoder.jp/contests/abc123",
    });

    mockedCodeforces.mockResolvedValue([invalid]);

    const result = await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(0);
    expect(result.contests).toHaveLength(0);
  });

  it("syncs providers independently when one provider fails", async () => {
    const codeforcesContest = makeContest({
      id: "codeforces:100",
    });

    const atcoderContest = makeContest({
      id: "atcoder:abc123",
      platform: "atcoder",
      url: "https://atcoder.jp/contests/abc123",
    });

    mockedCodeforces.mockRejectedValue(
      new Error("Codeforces unavailable")
    );

    mockedAtCoder.mockResolvedValue([
      atcoderContest,
    ]);

    const result = await syncContests();

    const codeforcesStored =
      getUpcomingStoredContestsByPlatform("codeforces");

    const atcoderStored =
      getUpcomingStoredContestsByPlatform("atcoder");

    expect(codeforcesStored).toHaveLength(0);
    expect(atcoderStored).toHaveLength(1);
    expect(atcoderStored[0].id).toBe("atcoder:abc123");

    expect(result.failedProviders).toContain("codeforces");
    expect(result.contests).toHaveLength(1);

    expect(codeforcesContest.id).toBe(
      "codeforces:100"
    );
  });

  it("does not partially sync when a provider returns mixed valid and invalid data", async () => {
    const existing = makeContest({
      id: "codeforces:100",
      name: "Existing Contest",
    });

    const valid = makeContest({
      id: "codeforces:200",
      name: "New Contest",
    });

    const invalid = makeContest({
      id: "",
      name: "Broken Contest",
    });

    saveContests([existing]);

    mockedCodeforces.mockResolvedValue([
      valid,
      invalid,
    ]);

    await syncContests();

    const stored = getUpcomingStoredContestsByPlatform(
      "codeforces"
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("codeforces:100");
  });
});
