import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

mkdirSync(".data", { recursive: true });

const db = new Database(".data/termin.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS contests (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    url TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_contests_start_time
  ON contests (start_time)
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders(
  id TEXT PRIMARY KEY,
  contest_id TEXT NOT NULL,
  minutes_before INTEGER NOT NULL,
  remind_at TEXT NOT NULL,
  sent_at TEXT,
    UNIQUE(contest_id, minutes_before)
  )
`);

export default db;
