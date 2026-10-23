import type Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const DEFAULT_MIGRATIONS_DIR = path.join(
  process.cwd(),
  "src/lib/db/migrations"
);

type MigrationRow = {
  name: string;
};

/**
 * Applies every unapplied `.sql` file in name order, once.
 *
 * Each migration and its ledger entry commit together, so a failed migration
 * leaves the database untouched and the error names the offending file.
 */
export function runMigrations(
  db: Database.Database,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = db
    .prepare("SELECT name FROM schema_migrations")
    .all() as MigrationRow[];
  const applied = new Set(appliedRows.map((row) => row.name));

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");

    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
      ).run(file, new Date().toISOString());
    });

    try {
      apply();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${file} failed: ${message}`);
    }

    newlyApplied.push(file);
  }

  return newlyApplied;
}
