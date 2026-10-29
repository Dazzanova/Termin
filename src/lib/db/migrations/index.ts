import type { Migration } from "../migrate";

/**
 * Ordered schema changes. They are inlined rather than read from disk so the
 * server bundle is self-contained on a host that only ships `dist/`.
 */
export const MIGRATIONS: Migration[] = [
  {
    name: "001_personalization_preferences.sql",
    sql: `
      CREATE TABLE preferences_new (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled_platforms TEXT NOT NULL,
        max_contests_per_week INTEGER NOT NULL DEFAULT 5,
        preferred_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
        preferred_time_windows TEXT NOT NULL DEFAULT '[{"start":18,"end":23}]',
        platform_weights TEXT NOT NULL DEFAULT '{}'
      );

      INSERT INTO preferences_new (id, enabled_platforms)
      SELECT id, enabled_platforms FROM preferences;

      DROP TABLE preferences;
      ALTER TABLE preferences_new RENAME TO preferences;
    `,
  },
  {
    name: "002_contest_priorities.sql",
    sql: `
      CREATE TABLE IF NOT EXISTS contest_priorities (
        contest_id TEXT PRIMARY KEY,
        prioritized_at TEXT NOT NULL,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
      );
    `,
  },
  {
    name: "003_training.sql",
    sql: `
      CREATE TABLE IF NOT EXISTS platform_accounts (
        platform TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        linked_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problems (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        contest_id TEXT NOT NULL,
        problem_index TEXT NOT NULL,
        name TEXT NOT NULL,
        rating INTEGER,
        tags TEXT NOT NULL DEFAULT '[]',
        url TEXT NOT NULL,
        imported_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_problems_contest
        ON problems (platform, contest_id);

      CREATE INDEX IF NOT EXISTS idx_problems_rating
        ON problems (rating);

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        problem_id TEXT NOT NULL,
        verdict TEXT NOT NULL,
        submitted_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_problem
        ON submissions (problem_id);

      CREATE TABLE IF NOT EXISTS problem_reviews (
        problem_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('due', 'scheduled', 'done', 'dropped')),
        due_at TEXT NOT NULL,
        interval_days INTEGER NOT NULL DEFAULT 1,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_problem_reviews_due
        ON problem_reviews (status, due_at);

      CREATE TABLE IF NOT EXISTS training_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    name: "004_rating_history.sql",
    sql: `
      CREATE TABLE IF NOT EXISTS rating_history (
        platform TEXT NOT NULL,
        contest_id TEXT NOT NULL,
        contest_name TEXT NOT NULL,
        rank INTEGER,
        old_rating INTEGER NOT NULL,
        new_rating INTEGER NOT NULL,
        rated_at TEXT NOT NULL,
        PRIMARY KEY (platform, contest_id)
      );

      CREATE INDEX IF NOT EXISTS idx_rating_history_rated_at
        ON rating_history (platform, rated_at);
    `,
  },
];
