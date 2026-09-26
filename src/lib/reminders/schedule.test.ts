import { describe, expect, it, vi } from "vitest";
import type { Contest } from "../contests/types";

vi.mock("./repository", () => ({
  saveReminder: vi.fn(),
}));

import { saveReminder } from "./repository";
import {
  createReminder,
  scheduleReminders,
} from "./schedule";

const mockedSaveReminder = vi.mocked(saveReminder);

function makeContest(): Contest {
  return {
    id: "codeforces:123",
    platform: "codeforces",
    name: "Codeforces Round 900",
    startTime: new Date("2026-09-26T18:00:00.000Z"),
    durationSeconds: 7200,
    url: "https://codeforces.com/contest/123",
  };
}

describe("createReminder", () => {
  it("calculates the reminder time correctly", () => {
    const contest = makeContest();

    const reminder = createReminder(contest, {
      id: "15m",
      minutesBefore: 15,
      label: "15 minutes before",
    });

    expect(reminder.id).toBe("codeforces:123:15m");
    expect(reminder.contestId).toBe("codeforces:123");
    expect(reminder.minutesBefore).toBe(15);
    expect(reminder.remindAt.toISOString()).toBe(
      "2026-09-26T17:45:00.000Z"
    );
    expect(reminder.sentAt).toBeNull();
  });
});

describe("scheduleReminders", () => {
  it("creates all future default reminders", () => {
    const contest = makeContest();

    const reminders = scheduleReminders(
      contest,
      new Date("2026-09-26T16:00:00.000Z")
    );

    expect(reminders).toHaveLength(3);

    expect(reminders.map((r) => r.remindAt.toISOString()))
      .toEqual([
        "2026-09-26T17:00:00.000Z",
        "2026-09-26T17:45:00.000Z",
        "2026-09-26T17:55:00.000Z",
      ]);

    expect(mockedSaveReminder).toHaveBeenCalledTimes(3);
  });

  it("does not schedule reminders that have already passed", () => {
    const contest = makeContest();

    const reminders = scheduleReminders(
      contest,
      new Date("2026-09-26T17:50:00.000Z")
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(
      "codeforces:123:5m"
    );
  });
});
