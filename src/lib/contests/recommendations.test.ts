import { beforeEach, describe, expect, it } from "vitest";
import type { Contest } from "./types";
import type { UserPreferences } from "../preferences/types";
import db from "../db/database";
import { saveContests, saveParticipationStatus } from "./repository";
import { DEFAULT_PREFERENCES } from "../preferences/types";
import {
  calculateRecommendations,
  getWeeklyCapacity,
} from "./recommendations";

function makeContest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: "codeforces:1",
    platform: "codeforces",
    name: "Sample Round",
    startTime: new Date(Date.now() + 3_600_000),
    durationSeconds: 7200,
    url: "https://example.com/1",
    ...overrides,
  };
}

/** Midweek timestamps, so weekday and time-window bonuses stay out of the way. */
function thisWeek(dayOffset: number, hour: number): Date {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const date = new Date(startOfWeek);
  date.setDate(startOfWeek.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);

  return date;
}

function noBonusPreferences(
  overrides: Partial<UserPreferences> = {}
): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    preferredDays: [],
    preferredTimeWindows: [],
    platformWeights: {},
    ...overrides,
  };
}

beforeEach(() => {
  db.exec("DELETE FROM participation");
  db.exec("DELETE FROM contests");
});

describe("recommendations", () => {
  it("ranks a contest marked Planned above an otherwise equal one", () => {
    const planned = makeContest({ id: "codeforces:1", startTime: thisWeek(1, 10) });
    const unplanned = makeContest({ id: "codeforces:2", startTime: thisWeek(1, 20) });

    saveContests([planned, unplanned]);
    saveParticipationStatus(planned.id, "planned");

    const recommendations = calculateRecommendations(
      [planned, unplanned],
      noBonusPreferences()
    );

    expect(recommendations[0].contest.id).toBe(planned.id);
    expect(recommendations[0].score).toBe(20);
    expect(recommendations[1].score).toBe(0);
  });

  it("flags both contests when two planned contests overlap", () => {
    const first = makeContest({
      id: "codeforces:1",
      startTime: thisWeek(1, 10),
      durationSeconds: 3600,
    });
    const second = makeContest({
      id: "codeforces:2",
      startTime: new Date(thisWeek(1, 10).getTime() + 30 * 60_000),
      durationSeconds: 3600,
    });

    saveContests([first, second]);
    saveParticipationStatus(first.id, "planned");
    saveParticipationStatus(second.id, "planned");

    const recommendations = calculateRecommendations(
      [first, second],
      noBonusPreferences()
    );

    expect(recommendations.every((rec) => rec.isConflict)).toBe(true);
    expect(
      recommendations.every((rec) =>
        rec.reasons.includes("Overlaps a contest you planned")
      )
    ).toBe(true);
  });

  it("flags only the unplanned contest when it clashes with a plan", () => {
    const planned = makeContest({
      id: "codeforces:1",
      startTime: thisWeek(1, 10),
      durationSeconds: 3600,
    });
    const other = makeContest({
      id: "codeforces:2",
      startTime: new Date(thisWeek(1, 10).getTime() + 30 * 60_000),
      durationSeconds: 3600,
    });

    saveContests([planned, other]);
    saveParticipationStatus(planned.id, "planned");

    const recommendations = calculateRecommendations(
      [planned, other],
      noBonusPreferences()
    );

    const plannedRec = recommendations.find(
      (rec) => rec.contest.id === planned.id
    )!;
    const otherRec = recommendations.find(
      (rec) => rec.contest.id === other.id
    )!;

    // The planned contest is the anchor; the clashing one is demoted instead.
    expect(plannedRec.isConflict).toBe(false);
    expect(otherRec.isConflict).toBe(true);
    expect(otherRec.reasons).toContain("Overlaps a contest you planned");
  });
});

describe("weekly capacity", () => {
  it("counts only planned contests inside the current week", () => {
    const plannedThisWeek = makeContest({
      id: "codeforces:1",
      startTime: thisWeek(1, 12),
    });
    const plannedNextWeek = makeContest({
      id: "codeforces:2",
      startTime: thisWeek(8, 12),
    });
    const unplannedThisWeek = makeContest({
      id: "codeforces:3",
      startTime: thisWeek(2, 12),
    });

    const contests = [plannedThisWeek, plannedNextWeek, unplannedThisWeek];
    saveContests(contests);
    saveParticipationStatus(plannedThisWeek.id, "planned");
    saveParticipationStatus(plannedNextWeek.id, "planned");

    const capacity = getWeeklyCapacity(
      contests,
      noBonusPreferences({ maxContestsPerWeek: 5 })
    );

    expect(capacity).toEqual({ remaining: 4, total: 5 });
  });

  it("reports the full cap when nothing is planned", () => {
    const capacity = getWeeklyCapacity(
      [makeContest({ startTime: thisWeek(1, 12) })],
      noBonusPreferences({ maxContestsPerWeek: 3 })
    );

    expect(capacity).toEqual({ remaining: 3, total: 3 });
  });
});
