import { client, ready } from "../db/database";
import type { Reminder } from "./types";

type ReminderRow = {
  id: string;
  contest_id: string;
  minutes_before: number;
  remind_at: string;
  sent_at: string | null;
};

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    contestId: row.contest_id,
    minutesBefore: row.minutes_before,
    remindAt: new Date(row.remind_at),
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
  };
}

export async function getRemindersForContest(
  contestId: string
): Promise<Reminder[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT
      id,
      contest_id,
      minutes_before,
      remind_at,
      sent_at
    FROM reminders
    WHERE contest_id = ?
    ORDER BY remind_at ASC`,
    args: [contestId],
  });

  return (result.rows as unknown as ReminderRow[]).map(rowToReminder);
}

export async function getDueReminders(
  now: Date = new Date()
): Promise<Reminder[]> {
  await ready();

  const result = await client.execute({
    sql: `SELECT
      id,
      contest_id,
      minutes_before,
      remind_at,
      sent_at
    FROM reminders
    WHERE sent_at IS NULL
      AND remind_at <= ?
    ORDER BY remind_at ASC`,
    args: [now.toISOString()],
  });

  return (result.rows as unknown as ReminderRow[]).map(rowToReminder);
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  await ready();

  await client.execute({
    sql: `INSERT INTO reminders (
      id,
      contest_id,
      minutes_before,
      remind_at,
      sent_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(contest_id, minutes_before) DO UPDATE SET
      remind_at = excluded.remind_at,
      sent_at = CASE
        WHEN reminders.remind_at != excluded.remind_at
        THEN NULL
        ELSE reminders.sent_at
      END`,
    args: [
      reminder.id,
      reminder.contestId,
      reminder.minutesBefore,
      reminder.remindAt.toISOString(),
      reminder.sentAt?.toISOString() ?? null,
    ],
  });
}

export async function markReminderSent(id: string): Promise<void> {
  await ready();

  await client.execute({
    sql: "UPDATE reminders SET sent_at = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}
