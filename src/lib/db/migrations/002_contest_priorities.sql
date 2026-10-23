-- Table to track user-defined contest priorities independently of participation status
CREATE TABLE IF NOT EXISTS contest_priorities (
  contest_id TEXT PRIMARY KEY,
  prioritized_at TEXT NOT NULL,
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
);
