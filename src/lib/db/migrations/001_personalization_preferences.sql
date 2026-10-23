-- Migration to extend preferences table for Personalization Engine
PRAGMA foreign_keys = OFF;

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

PRAGMA foreign_keys = ON;
