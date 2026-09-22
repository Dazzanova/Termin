import { describe, expect, it } from "vitest";
import { reconcileContests } from "./reconcile";
import type { Contest } from "./types";

const contest = (
  overrides: Partial<Contest> = {}
): Contest => ({
  id: "codeforces:123",
  platform: "codeforces",
  name: "Test Contest",
  startTime: new Date("2026-10-01T12:00:00.000Z"),
  durationSeconds: 7200,
  url: "https://codeforces.com/contest/123",
  ...overrides,
});

describe("reconcileContests", () => {
  it("detects a new contest", () => {
    const changes = reconcileContests([], [contest()]);

    expect(changes).toEqual([
      {
        type: "added",
        current: contest(),
      },
    ]);
  });

  it("detects a changed start time", () => {
    const previous = contest();

    const current = contest({
      startTime: new Date("2026-10-01T13:00:00.000Z"),
    });

    const changes = reconcileContests([previous], [current]);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "updated",
      previous,
      current,
      changes: [
        {
          field: "startTime",
          previous: "2026-10-01T12:00:00.000Z",
          current: "2026-10-01T13:00:00.000Z",
        },
      ],
    });
  });

  it("detects multiple changed fields", () => {
    const previous = contest();

    const current = contest({
      name: "Updated Contest",
      durationSeconds: 10800,
    });

    const changes = reconcileContests([previous], [current]);

    expect(changes[0]).toMatchObject({
      type: "updated",
      changes: [
        {
          field: "name",
        },
        {
          field: "durationSeconds",
        },
      ],
    });
  });

  it("does not report unchanged contests", () => {
    const current = contest();

    expect(reconcileContests([current], [current])).toEqual([]);
  });

  it("does not treat a missing upcoming contest as removed", () => {
    const previous = contest();

    expect(reconcileContests([previous], [])).toEqual([]);
  });
});
