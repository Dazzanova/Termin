import { describe, expect, it } from "vitest";
import {
  CodeforcesError,
  isUnratedRatingError,
  mapProblemset,
  mapRatingHistory,
  mapSubmissions,
} from "./client";

describe("mapProblemset", () => {
  it("builds problem ids, urls, and tags", () => {
    const problems = mapProblemset({
      problems: [
        {
          contestId: 1001,
          index: "A",
          name: "Array Cloning",
          rating: 800,
          tags: ["implementation"],
        },
      ],
    });

    expect(problems).toEqual([
      {
        id: "codeforces:1001A",
        platform: "codeforces",
        contestId: "1001",
        index: "A",
        name: "Array Cloning",
        rating: 800,
        tags: ["implementation"],
        url: "https://codeforces.com/problemset/problem/1001/A",
      },
    ]);
  });

  it("skips problems without a contest id", () => {
    const problems = mapProblemset({
      problems: [
        { index: "A", name: "Legacy", rating: 1000, tags: [] },
        { contestId: 7, index: "B", name: "Kept" },
      ],
    });

    expect(problems).toHaveLength(1);
    expect(problems[0].id).toBe("codeforces:7B");
    expect(problems[0].rating).toBeNull();
    expect(problems[0].tags).toEqual([]);
  });
});

describe("mapSubmissions", () => {
  it("keeps the verdict and maps the problem id", () => {
    const submissions = mapSubmissions([
      {
        id: 42,
        contestId: 1001,
        problem: { index: "B" },
        verdict: "WRONG_ANSWER",
        creationTimeSeconds: 1_700_000_000,
      },
    ]);

    expect(submissions).toEqual([
      {
        id: "codeforces:42",
        platform: "codeforces",
        problemId: "codeforces:1001B",
        verdict: "WRONG_ANSWER",
        submittedAt: new Date(1_700_000_000 * 1000),
      },
    ]);
  });

  it("drops entries without a contest or verdict", () => {
    const submissions = mapSubmissions([
      {
        id: 1,
        problem: { index: "A" },
        verdict: "OK",
        creationTimeSeconds: 1,
      },
      {
        id: 2,
        contestId: 1001,
        problem: { index: "A" },
        creationTimeSeconds: 2,
      },
    ]);

    expect(submissions).toHaveLength(0);
  });
});

describe("mapRatingHistory", () => {
  it("maps rating updates to entries", () => {
    const entries = mapRatingHistory([
      {
        contestId: 1001,
        contestName: "Codeforces Round 1001 (Div. 2)",
        handle: "tourist",
        rank: 1200,
        ratingUpdateTimeSeconds: 1_700_000_000,
        oldRating: 1400,
        newRating: 1432,
      },
    ]);

    expect(entries).toEqual([
      {
        platform: "codeforces",
        contestId: "1001",
        contestName: "Codeforces Round 1001 (Div. 2)",
        rank: 1200,
        oldRating: 1400,
        newRating: 1432,
        ratedAt: new Date(1_700_000_000 * 1000),
      },
    ]);
  });
});

describe("isUnratedRatingError", () => {
  it("recognises a handle with no rated contests", () => {
    expect(
      isUnratedRatingError(
        new CodeforcesError(
          "handle: User x has not participated in any rated contests"
        )
      )
    ).toBe(true);
  });

  it("does not swallow other failures", () => {
    expect(
      isUnratedRatingError(new CodeforcesError("handle: User x not found"))
    ).toBe(false);
    expect(isUnratedRatingError(new Error("boom"))).toBe(false);
  });
});
