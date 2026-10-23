import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

const dbPath = process.env.TERMIN_DB_PATH ?? ".data/termin.db";

if (dbPath !== ":memory:") {
  mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

db.exec(`
  CREATE TABLE IF NOT EXISTS participation (
    contest_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('planned', 'participated', 'skipped')),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contest_id) REFERENCES contests(id)
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_participation_status
  ON participation (status)
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled_platforms TEXT NOT NULL
  )
`);

runMigrations(db);

export default db;
