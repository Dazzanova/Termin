import Database from "better-sqlite3";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

function createBaselineDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled_platforms TEXT NOT NULL
    )
  `);
  return db;
}

describe("runMigrations", () => {
  it("applies the tracked migrations in order", () => {
    const db = createBaselineDatabase();

    const applied = runMigrations(db);

    expect(applied).toEqual([
      "001_personalization_preferences.sql",
      "002_contest_priorities.sql",
      "003_training.sql",
      "004_rating_history.sql",
    ]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain("contest_priorities");
    expect(tables).toContain("schema_migrations");
    expect(tables).toContain("platform_accounts");
    expect(tables).toContain("problems");
    expect(tables).toContain("submissions");
    expect(tables).toContain("problem_reviews");
    expect(tables).toContain("rating_history");

    const columns = db
      .prepare("PRAGMA table_info(preferences)")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toContain("max_contests_per_week");
    expect(columns).toContain("preferred_time_windows");
  });

  it("does not re-apply migrations on a second run", () => {
    const db = createBaselineDatabase();

    runMigrations(db);

    expect(runMigrations(db)).toEqual([]);

    const count = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };

    expect(count.count).toBe(4);
  });

  it("names the failing migration and leaves the ledger untouched", () => {
    const db = createBaselineDatabase();
    const dir = mkdtempSync(path.join(tmpdir(), "termin-migrations-"));

    writeFileSync(
      path.join(dir, "001_broken.sql"),
      "CREATE TABLE broken (id INTEGER PRIMARY KEY"
    );

    expect(() => runMigrations(db, dir)).toThrow(/001_broken\.sql/);

    const count = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };

    expect(count.count).toBe(0);
  });
});
