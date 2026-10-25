-- Codeforces rating history, used for the profile chart and the suggestion
-- band anchor.

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
