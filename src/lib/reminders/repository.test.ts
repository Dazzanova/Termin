import { beforeEach, describe, expect, it } from "vitest";
import { client, ready } from "../db/database";
import type { Reminder } from "./types";
import {
  getDueReminders,
  getRemindersForContest,
  markReminderSent,
  saveReminder,
} from "./repository";

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "codeforces:123:15m",
    contestId: "codeforces:123",
    minutesBefore: 15,
    remindAt: new Date("2026-09-26T17:45:00.000Z"),
    sentAt: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await ready();
  await client.execute("DELETE FROM reminders");
});

describe("reminder repository", () => {
  it("saves and retrieves a reminder", async () => {
    const reminder = makeReminder();

    await saveReminder(reminder);

    const reminders = await getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(reminder.id);
    expect(reminders[0].remindAt.toISOString()).toBe(
      reminder.remindAt.toISOString()
    );
  });

  it("returns only due unsent reminders", async () => {
    await saveReminder(makeReminder());

    await saveReminder(
      makeReminder({
        id: "codeforces:123:5m",
        minutesBefore: 5,
        remindAt: new Date("2026-09-26T17:55:00.000Z"),
      })
    );

    const reminders = await getDueReminders(
      new Date("2026-09-26T17:50:00.000Z")
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe("codeforces:123:15m");
  });

  it("does not return sent reminders", async () => {
    await saveReminder(
      makeReminder({
        sentAt: new Date("2026-09-26T17:46:00.000Z"),
      })
    );

    const reminders = await getDueReminders(
      new Date("2026-09-26T18:00:00.000Z")
    );

    expect(reminders).toHaveLength(0);
  });

  it("marks a reminder as sent", async () => {
    await saveReminder(makeReminder());

    await markReminderSent("codeforces:123:15m");

    const reminders = await getRemindersForContest("codeforces:123");

    expect(reminders[0].sentAt).not.toBeNull();
  });

  it("resets sent state when the reminder time changes", async () => {
    await saveReminder(
      makeReminder({
        sentAt: new Date("2026-09-26T17:46:00.000Z"),
      })
    );

    await saveReminder(
      makeReminder({
        remindAt: new Date("2026-09-26T18:45:00.000Z"),
      })
    );

    const reminders = await getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].remindAt.toISOString()).toBe(
      "2026-09-26T18:45:00.000Z"
    );
    expect(reminders[0].sentAt).toBeNull();
  });

  it("preserves sent state when the reminder time does not change", async () => {
    await saveReminder(
      makeReminder({
        sentAt: new Date("2026-09-26T17:46:00.000Z"),
      })
    );

    await saveReminder(makeReminder());

    const reminders = await getRemindersForContest("codeforces:123");

    expect(reminders).toHaveLength(1);
    expect(reminders[0].sentAt).not.toBeNull();
  });
});
