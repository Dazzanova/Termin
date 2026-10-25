import { importCodeforcesData } from "../lib/training/import";
import { getAccount } from "../lib/training/repository";

const handleFlag = process.argv.indexOf("--handle");
const handle = handleFlag === -1 ? undefined : process.argv[handleFlag + 1];
const account = getAccount("codeforces");

if (!handle && !account) {
  console.error(
    [
      "No Codeforces handle linked yet.",
      "Link one in Settings (npm run dev, then /settings) or run:",
      "  npm run import -- --handle yourhandle",
    ].join("\n")
  );
  process.exit(1);
}

try {
  const summary = await importCodeforcesData(handle);

  console.log(
    `Imported ${summary.problems} problems and ${summary.submissions} submissions ` +
      `for ${handle ?? account?.handle}.`
  );
  const rating =
    summary.currentRating === null
      ? ""
      : ` · rating ${summary.currentRating} across ${summary.ratedContests} rated contest(s)`;

  console.log(
    `${summary.solved} solved · ${summary.queuedReviews} added to upsolve · ` +
      `${summary.closedReviews} review(s) closed${rating}.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
