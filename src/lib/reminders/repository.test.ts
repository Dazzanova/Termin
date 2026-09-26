import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import type { Reminder } from "./types";

vi.mock("../db/database", async () => {
  const { default: Database } =
    await import("better-sqlite3");

  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE reminders (
      id TEXT PRIMARY KEY,
      contest_id TEXT NOT NULL,
      minutes_before INTEGER NOT NULL,
      remind_at TEXT NOT NULL,
      sent_at TEXT,
      UNIQUE(contest_id, minutes_before)
    )
  `);

  return {
    default: db,
  };
});

import db from "../db/database";
import {
  getDueReminders,
  getRemindersForContest,
  markReminderSent,
  saveReminder,
} from "./repository";

function makeReminder(
  overrides: Partial<Reminder> = {}
): Reminder {
  return {
    id: "codeforces:123:15m",
    contestId: "codeforces:123",
    minutesBefore: 15,
    remindAt: new Date(
      "2026-09-26T17:45:00.000Z"
    ),
    sentAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  db.exec("DELETE FROM reminders");
});

describe("reminder repository", () => {
  it("saves and retrieves a reminder", () => {
    const reminder = makeReminder();

    saveReminder(reminder);

    const reminders =
      getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(reminder.id);
    expect(reminders[0].remindAt.toISOString()).toBe(
      reminder.remindAt.toISOString()
    );
  });

  it("returns only due unsent reminders", () => {
    saveReminder(makeReminder());

    saveReminder(
      makeReminder({
        id: "codeforces:123:5m",
        minutesBefore: 5,
        remindAt: new Date(
          "2026-09-26T17:55:00.000Z"
        ),
      })
    );

    const reminders = getDueReminders(
      new Date("2026-09-26T17:50:00.000Z")
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(
      "codeforces:123:15m"
    );
  });

  it("does not return sent reminders", () => {
    saveReminder(
      makeReminder({
        sentAt: new Date(
          "2026-09-26T17:46:00.000Z"
        ),
      })
    );

    const reminders = getDueReminders(
      new Date("2026-09-26T18:00:00.000Z")
    );

    expect(reminders).toHaveLength(0);
  });

  it("marks a reminder as sent", () => {
    saveReminder(makeReminder());

    markReminderSent("codeforces:123:15m");

    const reminders =
      getRemindersForContest("codeforces:123");

    expect(reminders[0].sentAt).not.toBeNull();
  });

  it("resets sent state when the reminder time changes", () => {
    saveReminder(
      makeReminder({
        sentAt: new Date(
          "2026-09-26T17:46:00.000Z"
        ),
      })
    );

    saveReminder(
      makeReminder({
        remindAt: new Date(
          "2026-09-26T18:45:00.000Z"
        ),
      })
    );

    const reminders =
      getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].remindAt.toISOString()).toBe(
      "2026-09-26T18:45:00.000Z"
    );
    expect(reminders[0].sentAt).toBeNull();
  });

  it("preserves sent state when the reminder time does not change", () => {
    saveReminder(
      makeReminder({
        sentAt: new Date(
          "2026-09-26T17:46:00.000Z"
        ),
      })
    );

    saveReminder(makeReminder());

    const reminders =
      getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].sentAt).not.toBeNull();
  });
});
