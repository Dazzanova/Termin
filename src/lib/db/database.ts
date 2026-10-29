import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./migrations/index";
import { runMigrations } from "./migrate";

const remoteUrl = process.env.TURSO_DATABASE_URL;

function resolveUrl(): string {
  if (remoteUrl) {
    return remoteUrl;
  }

  const dbPath = process.env.TERMIN_DB_PATH ?? ".data/termin.db";

  if (dbPath === ":memory:") {
    return ":memory:";
  }

  const absolute = path.resolve(dbPath);
  mkdirSync(path.dirname(absolute), { recursive: true });

  return `file:${absolute}`;
}

export const client = createClient({
  url: resolveUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const BASE_TABLES = [
  `CREATE TABLE IF NOT EXISTS contests (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    url TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contests_start_time
    ON contests (start_time)`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    contest_id TEXT NOT NULL,
    minutes_before INTEGER NOT NULL,
    remind_at TEXT NOT NULL,
    sent_at TEXT,
    UNIQUE(contest_id, minutes_before)
  )`,
  `CREATE TABLE IF NOT EXISTS participation (
    contest_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('planned', 'participated', 'skipped')),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contest_id) REFERENCES contests(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_participation_status
    ON participation (status)`,
  `CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled_platforms TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

async function initialize(): Promise<void> {
  if (!remoteUrl) {
    // Remote libSQL manages these itself, and rejects journal-mode changes.
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA foreign_keys = ON");
  }

  await client.batch(
    BASE_TABLES.map((sql) => ({ sql })),
    "write"
  );

  await runMigrations(client, MIGRATIONS);
}

let readyPromise: Promise<void> | null = null;

/**
 * Creates the base tables and applies pending migrations exactly once.
 * Repository functions await this, so callers never have to sequence startup.
 */
export function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = initialize();
  }

  return readyPromise;
}

export default client;
