import { beforeEach, describe, expect, it } from "vitest";
import { client, ready } from "../db/database";
import {
  listProblems,
  listRatingHistory,
  listSubmissions,
  replaceRatingHistory,
  replaceSubmissions,
  saveProblems,
} from "./repository";
import type { Problem, RatingEntry, Submission } from "./types";

const PROBLEM: Problem = {
  id: "codeforces:1001A",
  platform: "codeforces",
  contestId: "1001",
  index: "A",
  name: "Array Cloning",
  rating: 800,
  tags: ["implementation"],
  url: "https://codeforces.com/problemset/problem/1001/A",
};

const SUBMISSION: Submission = {
  id: "codeforces:1",
  platform: "codeforces",
  problemId: PROBLEM.id,
  verdict: "OK",
  submittedAt: new Date("2026-10-01T12:00:00.000Z"),
};

const RATING: RatingEntry = {
  platform: "codeforces",
  contestId: "1001",
  contestName: "Codeforces Round 1001 (Div. 2)",
  rank: 1200,
  oldRating: 1400,
  newRating: 1432,
  ratedAt: new Date("2026-10-02T12:00:00.000Z"),
};

beforeEach(async () => {
  await ready();
  await client.execute("DELETE FROM rating_history");
  await client.execute("DELETE FROM problem_reviews");
  await client.execute("DELETE FROM submissions");
  await client.execute("DELETE FROM problems");
});

describe("listProblems and listSubmissions", () => {
  it("returns the imported catalog and history", async () => {
    await saveProblems([PROBLEM]);
    await replaceSubmissions([SUBMISSION]);

    expect(await listProblems()).toEqual([PROBLEM]);
    expect(await listSubmissions()).toEqual([SUBMISSION]);
  });
});

describe("rating history", () => {
  it("round-trips rows in rated order", async () => {
    const later: RatingEntry = {
      ...RATING,
      contestId: "1002",
      ratedAt: new Date("2026-10-09T12:00:00.000Z"),
    };

    await replaceRatingHistory([later, RATING]);

    expect(await listRatingHistory()).toEqual([RATING, later]);
  });

  it("replaces rather than appends", async () => {
    await replaceRatingHistory([RATING]);
    await replaceRatingHistory([{ ...RATING, newRating: 1500 }]);

    expect(await listRatingHistory()).toHaveLength(1);
    expect((await listRatingHistory())[0].newRating).toBe(1500);
  });
});
