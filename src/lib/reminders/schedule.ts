import type { Contest } from "../contests/types";
import { saveReminder } from "./repository";
import type { Reminder, ReminderOffset } from "./types";

export const DEFAULT_REMINDER_OFFSETS: ReminderOffset[] = [
  {
    id: "1h",
    minutesBefore: 60,
    label: "1 hour before",
  },
  {
    id: "15m",
    minutesBefore: 15,
    label: "15 minutes before",
  },
  {
    id: "5m",
    minutesBefore: 5,
    label: "5 minutes before",
  },
];

export function createReminder(
  contest: Contest,
  offset: ReminderOffset
): Reminder {
  const remindAt = new Date(
    contest.startTime.getTime() -
      offset.minutesBefore * 60 * 1000
  );

  return {
    id: `${contest.id}:${offset.id}`,
    contestId: contest.id,
    minutesBefore: offset.minutesBefore,
    remindAt,
    sentAt: null,
  };
}

export function scheduleReminders(
  contest: Contest,
  now: Date = new Date()
): Reminder[] {
  const reminders = DEFAULT_REMINDER_OFFSETS
    .map((offset) => createReminder(contest, offset))
    .filter((reminder) => reminder.remindAt > now);

  for (const reminder of reminders) {
    saveReminder(reminder);
  }

  return reminders;
}
