-- Training loop: linked handles, a cached problem catalog, imported
-- submissions, and the upsolve/review queue.

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
