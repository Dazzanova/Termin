import db from "../db/database";
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

const getRemindersForContestStatement = db.prepare(`
  SELECT
    id,
    contest_id,
    minutes_before,
    remind_at,
    sent_at
  FROM reminders
  WHERE contest_id = ?
  ORDER BY remind_at ASC
`);

const getDueRemindersStatement = db.prepare(`
  SELECT
    id,
    contest_id,
    minutes_before,
    remind_at,
    sent_at
  FROM reminders
  WHERE sent_at IS NULL
    AND remind_at <= ?
  ORDER BY remind_at ASC
`);

const saveReminderStatement = db.prepare(`
  INSERT INTO reminders (
    id,
    contest_id,
    minutes_before,
    remind_at,
    sent_at
  )
  VALUES (
    @id,
    @contest_id,
    @minutes_before,
    @remind_at,
    @sent_at
  )
  ON CONFLICT(contest_id, minutes_before) DO UPDATE SET
    remind_at = excluded.remind_at,
    sent_at = CASE
      WHEN reminders.remind_at != excluded.remind_at
      THEN NULL
      ELSE reminders.sent_at
    END
`);

const markReminderSentStatement = db.prepare(`
  UPDATE reminders
  SET sent_at = ?
  WHERE id = ?
`);

export function getRemindersForContest(
  contestId: string
): Reminder[] {
  const rows = getRemindersForContestStatement.all(
    contestId
  ) as ReminderRow[];

  return rows.map(rowToReminder);
}

export function getDueReminders(
  now: Date = new Date()
): Reminder[] {
  const rows = getDueRemindersStatement.all(
    now.toISOString()
  ) as ReminderRow[];

  return rows.map(rowToReminder);
}

export function saveReminder(reminder: Reminder): void {
  saveReminderStatement.run({
    id: reminder.id,
    contest_id: reminder.contestId,
    minutes_before: reminder.minutesBefore,
    remind_at: reminder.remindAt.toISOString(),
    sent_at: reminder.sentAt?.toISOString() ?? null,
  });
}

export function markReminderSent(id: string): void {
  markReminderSentStatement.run(
    new Date().toISOString(),
    id
  );
}
