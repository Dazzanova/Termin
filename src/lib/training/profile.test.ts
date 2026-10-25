import { describe, expect, it } from "vitest";
import {
  buildRatingSummary,
  buildSuggestions,
  buildWeaknessProfile,
  resolveAnchor,
} from "./profile";
import type { Problem, RatingEntry, Submission } from "./types";

function makeProblem(
  index: string,
  rating: number | null,
  tags: string[]
): Problem {
  return {
    id: `codeforces:1001${index}`,
    platform: "codeforces",
    contestId: "1001",
    index,
    name: `Problem ${index}`,
    rating,
    tags,
    url: `https://codeforces.com/problemset/problem/1001/${index}`,
  };
}

function submission(
  id: string,
  problemId: string,
  verdict = "OK"
): Submission {
  return {
    id: `codeforces:${id}`,
    platform: "codeforces",
    problemId,
    verdict,
    submittedAt: new Date("2026-10-01T12:00:00.000Z"),
  };
}

function rating(
  contestId: string,
  oldRating: number,
  newRating: number,
  day: number
): RatingEntry {
  return {
    platform: "codeforces",
    contestId,
    contestName: `Round ${contestId}`,
    rank: 1000,
    oldRating,
    newRating,
    ratedAt: new Date(
      `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`
    ),
  };
}

describe("buildWeaknessProfile", () => {
  it("computes solve rate and median solved rating per tag", () => {
    const a = makeProblem("A", 1200, ["dp"]);
    const b = makeProblem("B", 1400, ["dp"]);
    const c = makeProblem("C", 1600, ["dp"]);

    expect(
      buildWeaknessProfile(
        [a, b, c],
        [
          submission("1", a.id),
          submission("2", b.id),
          submission("3", c.id, "WRONG_ANSWER"),
        ]
      )
    ).toEqual([
      {
        tag: "dp",
        attempted: 3,
        solved: 2,
        solveRate: 2 / 3,
        medianSolvedRating: 1300,
      },
    ]);
  });

  it("needs three attempted problems before a tag qualifies", () => {
    const a = makeProblem("A", 1200, ["dp"]);
    const b = makeProblem("B", 1400, ["dp"]);

    expect(
      buildWeaknessProfile(
        [a, b],
        [submission("1", a.id), submission("2", b.id)]
      )
    ).toEqual([]);
  });

  it("ranks by solve rate, then median rating, then tag", () => {
    const problems = [
      makeProblem("A", 800, ["dp"]),
      makeProblem("B", 1200, ["dp"]),
      makeProblem("C", 1200, ["dp"]),
      makeProblem("D", 1400, ["graphs"]),
      makeProblem("E", 1600, ["graphs"]),
      makeProblem("F", 1600, ["graphs"]),
      makeProblem("G", 900, ["implementation"]),
      makeProblem("H", 900, ["implementation"]),
      makeProblem("I", 900, ["implementation"]),
    ];

    const submissions = [
      submission("1", problems[0].id),
      submission("2", problems[1].id, "WRONG_ANSWER"),
      submission("3", problems[2].id, "WRONG_ANSWER"),
      submission("4", problems[3].id),
      submission("5", problems[4].id, "WRONG_ANSWER"),
      submission("6", problems[5].id, "WRONG_ANSWER"),
      submission("7", problems[6].id),
      submission("8", problems[7].id),
      submission("9", problems[8].id, "WRONG_ANSWER"),
    ];

    const tags = buildWeaknessProfile(problems, submissions).map(
      (entry) => entry.tag
    );

    expect(tags).toEqual(["dp", "graphs", "implementation"]);
  });

  it("ignores submissions for problems outside the catalog", () => {
    const a = makeProblem("A", 1200, ["dp"]);
    const b = makeProblem("B", 1400, ["dp"]);

    expect(
      buildWeaknessProfile(
        [a, b],
        [
          submission("1", a.id),
          submission("2", b.id),
          submission("3", "codeforces:9999Z", "WRONG_ANSWER"),
        ]
      )
    ).toEqual([]);
  });
});

describe("resolveAnchor", () => {
  it("uses the current rating when available", () => {
    expect(
      resolveAnchor({
        currentRating: 1520,
        problems: [],
        submissions: [],
      })
    ).toEqual({ value: 1520, source: "rating" });
  });

  it("falls back to the 75th percentile of solved ratings", () => {
    const problems = [
      makeProblem("A", 800, ["dp"]),
      makeProblem("B", 1000, ["dp"]),
      makeProblem("C", 1200, ["dp"]),
      makeProblem("D", 1400, ["dp"]),
    ];
    const submissions = problems.map((problem, index) =>
      submission(String(index + 1), problem.id)
    );

    expect(
      resolveAnchor({ currentRating: null, problems, submissions })
    ).toEqual({ value: 1200, source: "solved" });
  });

  it("returns null without a rating or any solved rating", () => {
    const problem = makeProblem("A", 1200, ["dp"]);

    expect(
      resolveAnchor({
        currentRating: null,
        problems: [problem],
        submissions: [submission("1", problem.id, "WRONG_ANSWER")],
      })
    ).toEqual({ value: null, source: null });
  });
});

describe("buildSuggestions", () => {
  const weak = [
    {
      tag: "dp",
      attempted: 3,
      solved: 1,
      solveRate: 1 / 3,
      medianSolvedRating: 1200,
    },
  ];

  it("respects the band, weak tags, and exclusions", () => {
    const inBand = makeProblem("A", 1500, ["dp"]);
    const atCeiling = makeProblem("B", 1700, ["dp"]);
    const below = makeProblem("C", 1400, ["dp"]);
    const above = makeProblem("D", 1701, ["dp"]);
    const attempted = makeProblem("E", 1600, ["dp"]);
    const tracked = makeProblem("F", 1600, ["dp"]);
    const other = makeProblem("G", 1600, ["trees"]);

    const suggestions = buildSuggestions({
      problems: [inBand, atCeiling, below, above, attempted, tracked, other],
      submissions: [submission("1", attempted.id, "WRONG_ANSWER")],
      trackedProblemIds: new Set([tracked.id]),
      weakTags: weak,
      anchor: 1500,
      limit: 2,
    });

    expect(suggestions.map((entry) => entry.problem.id)).toEqual([
      inBand.id,
      atCeiling.id,
    ]);
  });

  it("widens the floor once when the band is thin", () => {
    const inBand = makeProblem("A", 1500, ["dp"]);
    const higher = makeProblem("B", 1600, ["dp"]);
    const widened = makeProblem("C", 1399, ["dp"]);
    const tooLow = makeProblem("D", 1349, ["dp"]);

    const suggestions = buildSuggestions({
      problems: [inBand, higher, widened, tooLow],
      submissions: [],
      trackedProblemIds: new Set(),
      weakTags: weak,
      anchor: 1500,
    });

    expect(suggestions.map((entry) => entry.problem.id)).toEqual([
      widened.id,
      inBand.id,
      higher.id,
    ]);
  });

  it("round-robins across weak tags, easiest first", () => {
    const dpOne = makeProblem("A", 1600, ["dp"]);
    const dpTwo = makeProblem("B", 1650, ["dp"]);
    const graphsOne = makeProblem("C", 1550, ["graphs"]);
    const graphsTwo = makeProblem("D", 1700, ["graphs"]);

    const suggestions = buildSuggestions({
      problems: [dpOne, dpTwo, graphsOne, graphsTwo],
      submissions: [],
      trackedProblemIds: new Set(),
      weakTags: [
        ...weak,
        {
          tag: "graphs",
          attempted: 3,
          solved: 1,
          solveRate: 1 / 3,
          medianSolvedRating: 1400,
        },
      ],
      anchor: 1500,
    });

    expect(suggestions.map((entry) => entry.tag)).toEqual([
      "dp",
      "graphs",
      "dp",
      "graphs",
    ]);
    expect(suggestions.map((entry) => entry.problem.id)).toEqual([
      dpOne.id,
      graphsOne.id,
      dpTwo.id,
      graphsTwo.id,
    ]);
  });

  it("returns nothing without an anchor or weak tags", () => {
    const problem = makeProblem("A", 1500, ["dp"]);

    expect(
      buildSuggestions({
        problems: [problem],
        submissions: [],
        trackedProblemIds: new Set(),
        weakTags: weak,
        anchor: null,
      })
    ).toEqual([]);

    expect(
      buildSuggestions({
        problems: [problem],
        submissions: [],
        trackedProblemIds: new Set(),
        weakTags: [],
        anchor: 1500,
      })
    ).toEqual([]);
  });
});

describe("buildRatingSummary", () => {
  it("computes current, peak, deltas, and a limited series", () => {
    const rows = [
      rating("1", 1200, 1300, 1),
      rating("2", 1300, 1500, 2),
      rating("3", 1500, 1400, 3),
    ];

    const summary = buildRatingSummary(rows, 2);

    expect(summary.current).toBe(1400);
    expect(summary.peak).toBe(1500);
    expect(summary.contests).toBe(3);
    expect(summary.lastDelta).toBe(-100);
    expect(summary.series).toHaveLength(2);
    expect(summary.series[0].contestId).toBe("2");
    expect(summary.series[0].delta).toBe(200);
  });

  it("handles an empty history", () => {
    expect(buildRatingSummary([])).toEqual({
      current: null,
      peak: null,
      contests: 0,
      lastDelta: null,
      series: [],
    });
  });
});
