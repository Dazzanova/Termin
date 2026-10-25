import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "./demo-data";

const NOW = new Date("2026-10-25T17:00:00.000Z");

describe("demo dataset", () => {
  const dataset = buildDemoDataset(NOW);
  const upcoming = dataset.contests.filter(
    (contest) => contest.startTime > NOW
  );
  const history = dataset.contests.filter(
    (contest) => contest.startTime < NOW
  );

  it("splits fixtures into upcoming and past contests", () => {
    expect(upcoming).toHaveLength(7);
    expect(history).toHaveLength(14);
  });

  it("uses unique contest ids", () => {
    const ids = dataset.contests.map((contest) => contest.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("populates every page, so all four platforms are present", () => {
    const platforms = new Set(dataset.contests.map((c) => c.platform));
    expect(platforms).toEqual(
      new Set(["codeforces", "atcoder", "codechef", "leetcode"])
    );
    expect(dataset.preferences.enabledPlatforms).toHaveLength(4);
  });

  it("plans three upcoming contests, keeping capacity below the cap", () => {
    const plannedUpcoming = dataset.participation.filter(
      (entry) =>
        entry.status === "planned" &&
        upcoming.some((contest) => contest.id === entry.contestId)
    );

    expect(plannedUpcoming).toHaveLength(3);
    expect(dataset.preferences.maxContestsPerWeek).toBeGreaterThan(3);
  });

  it("keeps at least two planned upcoming contests overlapping", () => {
    const plannedIds = new Set(
      dataset.participation
        .filter((entry) => entry.status === "planned")
        .map((entry) => entry.contestId)
    );
    const planned = upcoming.filter((contest) => plannedIds.has(contest.id));

    const overlaps = planned.some((first, index) =>
      planned.slice(index + 1).some((second) => {
        const firstEnd =
          first.startTime.getTime() + first.durationSeconds * 1000;
        const secondEnd =
          second.startTime.getTime() + second.durationSeconds * 1000;

        return (
          first.startTime.getTime() < secondEnd &&
          second.startTime.getTime() < firstEnd
        );
      })
    );

    expect(overlaps).toBe(true);
  });

  it("gives history a realistic participation mix", () => {
    const statuses = dataset.participation
      .filter((entry) => history.some((c) => c.id === entry.contestId))
      .map((entry) => entry.status);

    expect(statuses).toHaveLength(14);
    expect(statuses.filter((status) => status === "participated")).toHaveLength(
      9
    );
    expect(statuses.filter((status) => status === "skipped")).toHaveLength(2);
  });

  it("seeds enough training data for a populated profile", () => {
    const ratings = dataset.training.ratings;

    expect(ratings).toHaveLength(7);
    expect(ratings.at(-1)?.newRating).toBe(1520);
    expect(Math.max(...ratings.map((entry) => entry.newRating))).toBe(1560);

    const weakTagAttempts = new Set(
      dataset.training.submissions
        .map((entry) =>
          dataset.training.problems.find(
            (problem) => problem.id === entry.problemId
          )
        )
        .filter((problem) => problem?.tags.includes("dp"))
        .map((problem) => problem?.id)
    );

    expect(weakTagAttempts.size).toBe(3);
  });
});
