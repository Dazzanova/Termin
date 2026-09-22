import { syncContests } from "../lib/contests/sync";

const result = await syncContests();

console.log(`Synced ${result.contests.length} contests.`);

if (result.changes.length > 0) {
  console.log(`Detected ${result.changes.length} changes.`);
}

if (result.failedProviders.length > 0) {
  console.error(
    `Failed providers: ${result.failedProviders.join(", ")}`
  );

  process.exitCode = 1;
}
