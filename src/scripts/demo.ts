import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run demo` — seed disposable fixtures and start the dashboard against
 * them, so a fresh clone has something to look at without network access.
 *
 * The real database is never opened: the demo uses `.data/demo.db`, rebuilt
 * from scratch on every run.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const databasePath = path.resolve(root, ".data/demo.db");

process.env.TERMIN_DB_PATH = databasePath;
process.env.TERMIN_DEMO = "1";

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${databasePath}${suffix}`, { force: true });
}

const { seedDemoData } = await import("./seed-demo");
seedDemoData();

const port = process.env.PORT ?? "4321";
const astroBin = path.join(root, "node_modules", "astro", "bin", "astro.mjs");

console.log(`\n  Demo data seeded in .data/demo.db`);
console.log(`  Starting Termin on http://localhost:${port}\n`);

const child = spawn(process.execPath, [astroBin, "dev", "--port", port], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));
