import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./migrations/index";
import { runMigrations } from "./migrate";

async function createBaselineClient() {
  const client = createClient({ url: ":memory:" });

  await client.execute(`
    CREATE TABLE preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled_platforms TEXT NOT NULL
    )
  `);

  return client;
}

describe("runMigrations", () => {
  it("applies the tracked migrations in order", async () => {
    const client = await createBaselineClient();

    const applied = await runMigrations(client, MIGRATIONS);

    expect(applied).toEqual([
      "001_personalization_preferences.sql",
      "002_contest_priorities.sql",
      "003_training.sql",
      "004_rating_history.sql",
    ]);

    const tables = (
      await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    ).rows.map((row) => String(row.name));

    expect(tables).toContain("contest_priorities");
    expect(tables).toContain("schema_migrations");
    expect(tables).toContain("platform_accounts");
    expect(tables).toContain("problems");
    expect(tables).toContain("submissions");
    expect(tables).toContain("problem_reviews");
    expect(tables).toContain("rating_history");

    const columns = (
      await client.execute("PRAGMA table_info(preferences)")
    ).rows.map((row) => String(row.name));

    expect(columns).toContain("max_contests_per_week");
    expect(columns).toContain("preferred_time_windows");
  });

  it("does not re-apply migrations on a second run", async () => {
    const client = await createBaselineClient();

    await runMigrations(client, MIGRATIONS);

    expect(await runMigrations(client, MIGRATIONS)).toEqual([]);

    const count = await client.execute(
      "SELECT COUNT(*) AS count FROM schema_migrations"
    );

    expect(count.rows[0].count).toBe(4);
  });

  it("names the failing migration and leaves the ledger untouched", async () => {
    const client = await createBaselineClient();

    await expect(
      runMigrations(client, [
        {
          name: "001_broken.sql",
          sql: "CREATE TABLE broken (id INTEGER PRIMARY KEY",
        },
      ])
    ).rejects.toThrow(/001_broken\.sql/);

    const count = await client.execute(
      "SELECT COUNT(*) AS count FROM schema_migrations"
    );

    expect(count.rows[0].count).toBe(0);
  });
});
