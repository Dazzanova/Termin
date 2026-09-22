import type { Contest } from "./types";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeforcesContests } from "./providers/codeforces";
import { getCodeChefContests } from "./providers/codechef";
import { getLeetCodeContests } from "./providers/leetcode";
import { validateContests } from "./validate";
import { reconcileContests, type ContestChange } from "./reconcile";

type ContestProvider = {
  name: string;
  getContests: () => Promise<Contest[]>;
};

const providers: ContestProvider[] = [
  {
    name: "codeforces",
    getContests: getCodeforcesContests,
  },
  {
    name: "atcoder",
    getContests: getAtCoderContests,
  },
  {
    name: "codechef",
    getContests: getCodeChefContests,
  },
  {
    name: "leetcode",
    getContests: getLeetCodeContests,
  }
];

export async function getUpcomingContests(): Promise<Contest[]> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  const contests: Contest[] = [];

  results.forEach((result, index) => {
    const provider = providers[index];

    if (result.status === "rejected") {
      console.error(
        `Failed to fetch ${provider.name} contests:`,
        result.reason
      );

      return;
    }

    const validContests = validateContests(result.value);

    if (validContests.length !== result.value.length) {
      console.error(
        `${provider.name} returned invalid contests:`,
        result.value.length - validContests.length
      );
    }

    contests.push(...validContests);
  });

  return contests.sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
}
