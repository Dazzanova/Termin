import type { Contest } from "./types";
import { validateContests } from "./validate";
import { reconcileContests, type ContestChange } from "./reconcile";
import {
  getStoredContests,
  saveContests,
} from "./repository";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeChefContests } from "./providers/codechef";
import { getCodeforcesContests } from "./providers/codeforces";
import { getLeetCodeContests } from "./providers/leetcode";

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
  },
];

export type SyncResult = {
  contests: Contest[];
  changes: ContestChange[];
  failedProviders: string[];
};

export async function syncContests(): Promise<SyncResult> {
  const previous = getStoredContests();

  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  const contests: Contest[] = [];
  const failedProviders: string[] = [];

  results.forEach((result, index) => {
    const provider = providers[index];

    if (result.status === "rejected") {
      failedProviders.push(provider.name);

      console.error(
        `Failed to fetch ${provider.name} contests:`,
        result.reason
      );

      return;
    }

    const validContests = validateContests(result.value);

    if (validContests.length !== result.value.length) {
      console.error(
        `${provider.name} returned ${
          result.value.length - validContests.length
        } invalid contests`
      );
    }

    contests.push(...validContests);
  });

  const changes = reconcileContests(previous, contests);

  saveContests(contests);

  return {
    contests,
    changes,
    failedProviders,
  };
}
