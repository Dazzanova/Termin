import type { Client, InValue } from "@libsql/client";

export type Migration = {
  name: string;
  sql: string;
};

type MigrationRow = {
  name: string;
};

/**
 * Applies every unapplied migration in order, once.
 *
 * Each migration and its ledger entry commit together, so a failed migration
 * leaves the database untouched and the error names the offending file.
 */
export async function runMigrations(
  client: Client,
  migrations: Migration[]
): Promise<string[]> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = await client.execute("SELECT name FROM schema_migrations");
  const applied = new Set(
    (appliedRows.rows as unknown as MigrationRow[]).map((row) => row.name)
  );

  const sorted = [...migrations].sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  );

  const newlyApplied: string[] = [];

  for (const migration of sorted) {
    if (applied.has(migration.name)) {
      continue;
    }

    try {
      const transaction = await client.transaction("write");

      try {
        await transaction.executeMultiple(migration.sql);
        await transaction.execute({
          sql: "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
          args: [migration.name, new Date().toISOString()] as InValue[],
        });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${migration.name} failed: ${message}`);
    }

    newlyApplied.push(migration.name);
  }

  return newlyApplied;
}
