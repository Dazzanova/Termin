import { beforeEach, describe, expect, it, vi } from "vitest";
import { client, ready } from "../db/database";
import { saveContests, saveParticipationStatus } from "../contests/repository";
import {
  getAccount,
  countProblems,
  getReview,
  listRatingHistory,
} from "./repository";
import { importCodeforcesData } from "./import";
import type { Problem, Submission } from "./types";

vi.mock("../codeforces/client", () => ({
  fetchProblemset: vi.fn(),
  fetchSubmissions: vi.fn(),
  fetchRatingHistory: vi.fn(),
}));

import {
  fetchProblemset,
  fetchRatingHistory,
  fetchSubmissions,
} from "../codeforces/client";

const PROBLEM_A: Problem = {
  id: "codeforces:1001A",
  platform: "codeforces",
  contestId: "1001",
  index: "A",
  name: "Array Cloning",
  rating: 800,
  tags: ["implementation"],
  url: "https://codeforces.com/problemset/problem/1001/A",
};

const PROBLEM_B: Problem = {
  ...PROBLEM_A,
  id: "codeforces:1001B",
  index: "B",
  name: "Card Game",
  rating: 1200,
};

const SOLVED: Submission = {
  id: "codeforces:1",
  platform: "codeforces",
  problemId: PROBLEM_A.id,
  verdict: "OK",
  submittedAt: new Date(),
};

const RATING = {
  platform: "codeforces" as const,
  contestId: "1001",
  contestName: "Codeforces Round 1001 (Div. 2)",
  rank: 1200,
  oldRating: 1488,
  newRating: 1520,
  ratedAt: new Date("2026-10-01T12:00:00.000Z"),
};

beforeEach(async () => {
  vi.resetAllMocks();
  await ready();
  await client.execute("DELETE FROM rating_history");
  await client.execute("DELETE FROM problem_reviews");
  await client.execute("DELETE FROM submissions");
  await client.execute("DELETE FROM problems");
  await client.execute("DELETE FROM participation");
  await client.execute("DELETE FROM contests");
  await client.execute("DELETE FROM platform_accounts");
  await client.execute("DELETE FROM training_state");

  vi.mocked(fetchProblemset).mockResolvedValue([PROBLEM_A, PROBLEM_B]);
  vi.mocked(fetchSubmissions).mockResolvedValue([SOLVED]);
  vi.mocked(fetchRatingHistory).mockResolvedValue([RATING]);

  const contest = {
    id: "1001",
    platform: "codeforces" as const,
    name: "Codeforces Round 1001 (Div. 2)",
    startTime: new Date(Date.now() - 3 * 86_400_000),
    durationSeconds: 7200,
    url: "https://codeforces.com/contest/1001",
  };

  await saveContests([contest]);
  await saveParticipationStatus(contest.id, "participated");
});

describe("importCodeforcesData", () => {
  it("stores the catalog, the history, and the upsolve queue", async () => {
    const now = new Date();
    const summary = await importCodeforcesData("tourist", now);

    expect(summary.problems).toBe(2);
    expect(summary.submissions).toBe(1);
    expect(summary.solved).toBe(1);
    expect(summary.queuedReviews).toBe(1);
    expect(summary.closedReviews).toBe(0);
    expect(summary.ratedContests).toBe(1);
    expect(summary.currentRating).toBe(1520);

    expect((await getAccount("codeforces"))?.handle).toBe("tourist");
    expect(await listRatingHistory()).toEqual([RATING]);
    expect((await getReview(PROBLEM_B.id))?.status).toBe("due");
    expect(await getReview(PROBLEM_A.id)).toBeNull();
  });

  it("writes nothing when the API call fails", async () => {
    vi.mocked(fetchSubmissions).mockRejectedValue(
      new Error("handle not found")
    );

    await expect(importCodeforcesData("nobody")).rejects.toThrow(
      "handle not found"
    );

    expect(await countProblems()).toBe(0);
    expect(await getAccount("codeforces")).toBeNull();
  });

  it("writes nothing when rating history fails", async () => {
    vi.mocked(fetchRatingHistory).mockRejectedValue(
      new Error("rating unavailable")
    );

    await expect(importCodeforcesData("tourist")).rejects.toThrow(
      "rating unavailable"
    );

    expect(await countProblems()).toBe(0);
    expect(await listRatingHistory()).toEqual([]);
  });

  it("refuses to import without a handle", async () => {
    await expect(importCodeforcesData()).rejects.toThrow(
      "No Codeforces handle linked"
    );
    expect(fetchProblemset).not.toHaveBeenCalled();
  });
});
