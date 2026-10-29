import { beforeEach, describe, expect, it } from "vitest";
import type { Contest } from "../contests/types";

import { client, ready } from "../db/database";
import { DEFAULT_PREFERENCES } from "./types";
import {
  getPreferences,
  savePreferences,
  saveSubmittedPlatforms,
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

async function insertEnabledPlatforms(value: string): Promise<void> {
  await client.execute({
    sql: `INSERT INTO preferences (id, enabled_platforms)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET enabled_platforms = excluded.enabled_platforms`,
    args: [value],
  });
}

beforeEach(async () => {
  await ready();
  await client.execute("DELETE FROM preferences");
  await client.execute("DELETE FROM contests");
});

describe("preferences repository", () => {
  it("initializes first-run defaults when no preferences exist", async () => {
    const preferences = await getPreferences();

    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
    expect(preferences.enabledPlatforms).toEqual([
      "codeforces",
      "atcoder",
      "codechef",
      "leetcode",
    ]);

    const result = await client.execute(
      "SELECT * FROM preferences WHERE id = 1"
    );
    const row = result.rows[0] as unknown as {
      id: number;
      enabled_platforms: string;
    };

    expect(row).toBeDefined();
    expect(row.id).toBe(1);
    expect(JSON.parse(row.enabled_platforms)).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("saves and loads preferences", async () => {
    await savePreferences({
      enabledPlatforms: ["codeforces", "leetcode"],
    });

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual(["codeforces", "leetcode"]);
  });

  it("persists preferences across repository calls", async () => {
    await savePreferences({
      enabledPlatforms: ["atcoder"],
    });

    const firstCall = await getPreferences();
    const secondCall = await getPreferences();

    expect(firstCall.enabledPlatforms).toEqual(["atcoder"]);
    expect(secondCall.enabledPlatforms).toEqual(["atcoder"]);

    const result = await client.execute(
      "SELECT enabled_platforms FROM preferences WHERE id = 1"
    );
    const row = result.rows[0] as unknown as { enabled_platforms: string };
    expect(JSON.parse(row.enabled_platforms)).toEqual(["atcoder"]);
  });

  it("handles invalid/unsupported stored platform data safely", async () => {
    await insertEnabledPlatforms(
      JSON.stringify(["codeforces", "unsupported_platform", 123, null])
    );

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual(["codeforces"]);
  });

  it("handles malformed JSON in stored preferences safely", async () => {
    await insertEnabledPlatforms("{ malformed json");

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("handles non-array stored data safely", async () => {
    await insertEnabledPlatforms(JSON.stringify({ not: "an array" }));

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual(
      DEFAULT_PREFERENCES.enabledPlatforms
    );
  });

  it("sanitizes unsupported platforms on save", async () => {
    await savePreferences({
      enabledPlatforms: [
        "codeforces",
        "fake_platform" as never,
        "codeforces",
      ],
    });

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual(["codeforces"]);
  });
});

describe("save submitted platforms from form / untrusted input", () => {
  it("persists valid platform selection submitted from form", async () => {
    const result = await saveSubmittedPlatforms(["codeforces", "atcoder"]);
    expect(result.enabledPlatforms).toEqual(["codeforces", "atcoder"]);

    const loaded = await getPreferences();
    expect(loaded.enabledPlatforms).toEqual(["codeforces", "atcoder"]);
  });

  it("persists empty platform selection when no platforms are selected", async () => {
    await saveSubmittedPlatforms([]);
    const loaded = await getPreferences();
    expect(loaded.enabledPlatforms).toEqual([]);
  });

  it("filters out unsupported platforms from untrusted submission", async () => {
    const result = await saveSubmittedPlatforms([
      "codeforces",
      "hacker_earth",
      "topcoder",
      "<script>alert(1)</script>",
    ]);
    expect(result.enabledPlatforms).toEqual(["codeforces"]);

    const loaded = await getPreferences();
    expect(loaded.enabledPlatforms).toEqual(["codeforces"]);
  });

  it("deduplicates platforms from submission", async () => {
    const result = await saveSubmittedPlatforms([
      "leetcode",
      "leetcode",
      "codechef",
    ]);
    expect(result.enabledPlatforms).toEqual(["leetcode", "codechef"]);
  });

  it("handles non-array or malformed submitted input safely", async () => {
    await saveSubmittedPlatforms(null);
    expect((await getPreferences()).enabledPlatforms).toEqual([]);

    await saveSubmittedPlatforms("codeforces");
    expect((await getPreferences()).enabledPlatforms).toEqual(["codeforces"]);

    await saveSubmittedPlatforms(12345);
    expect((await getPreferences()).enabledPlatforms).toEqual([]);
  });
});

describe("platform filtering", () => {
  beforeEach(async () => {
    const future = new Date(Date.now() + 86_400_000);
    await saveContests([
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

  it("returns all contests when default preferences are active", async () => {
    const contests = await getUpcomingContests();
    expect(contests).toHaveLength(4);
  });

  it("filters upcoming contests to one platform", async () => {
    await savePreferences({
      enabledPlatforms: ["codeforces"],
    });

    const contests = await getUpcomingContests();
    expect(contests).toHaveLength(1);
    expect(contests[0].platform).toBe("codeforces");
    expect(contests[0].id).toBe("cf-1");
  });

  it("filters upcoming contests to multiple platforms", async () => {
    await savePreferences({
      enabledPlatforms: ["codeforces", "atcoder"],
    });

    const contests = await getUpcomingContests();
    expect(contests).toHaveLength(2);
    const platforms = contests.map((c) => c.platform);
    expect(platforms).toEqual(["codeforces", "atcoder"]);
  });

  it("returns no contests when empty platform selection is saved", async () => {
    await savePreferences({
      enabledPlatforms: [],
    });

    const preferences = await getPreferences();
    expect(preferences.enabledPlatforms).toEqual([]);

    const contests = await getUpcomingContests();
    expect(contests).toHaveLength(0);
  });

  it("filters directly in getUpcomingStoredContests repository call", async () => {
    const cfContests = await getUpcomingStoredContests(["codeforces"]);
    expect(cfContests).toHaveLength(1);
    expect(cfContests[0].platform).toBe("codeforces");

    const multiContests = await getUpcomingStoredContests([
      "codechef",
      "leetcode",
    ]);
    expect(multiContests).toHaveLength(2);
    expect(multiContests.map((c) => c.platform)).toEqual([
      "codechef",
      "leetcode",
    ]);

    const emptyContests = await getUpcomingStoredContests([]);
    expect(emptyContests).toHaveLength(0);

    const allContests = await getUpcomingStoredContests();
    expect(allContests).toHaveLength(4);
  });
});
