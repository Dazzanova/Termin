import type { Contest, ContestPlatform } from "./types";
import { validateContests } from "./validate";
import { reconcileContests, type ContestChange } from "./reconcile";
import {
  getUpcomingStoredContestsByPlatform,
  saveContests,
  removeStaleUpcomingContests,
} from "./repository";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeChefContests } from "./providers/codechef";
import { getCodeforcesContests } from "./providers/codeforces";
import { getLeetCodeContests } from "./providers/leetcode";

type ContestProvider = {
  platform: ContestPlatform;
  getContests: () => Promise<Contest[]>;
};

const providers: ContestProvider[] = [
  {
    platform: "codeforces",
    getContests: getCodeforcesContests,
  },
  {
    platform: "atcoder",
    getContests: getAtCoderContests,
  },
  {
    platform: "codechef",
    getContests: getCodeChefContests,
  },
  {
    platform: "leetcode",
    getContests: getLeetCodeContests,
  },
];

export type SyncResult = {
  contests: Contest[];
  changes: ContestChange[];
  failedProviders: string[];
};

export async function syncContests(): Promise<SyncResult> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  const allContests: Contest[] = [];
  const allChanges: ContestChange[] = [];
  const failedProviders: string[] = [];

  results.forEach((result, index) => {
    const provider = providers[index];

    if (result.status === "rejected") {
      failedProviders.push(provider.platform);

      console.error(
        `Failed to fetch ${provider.platform} contests:`,
        result.reason
      );

      // Do not touch this provider's stored contests — keep them as-is.
      return;
    }

    const validContests = validateContests(result.value);

    if (validContests.length !== result.value.length) {
      console.error(
        `${provider.platform} returned ${
          result.value.length - validContests.length
        } invalid contests`
      );
    }

    // Reconcile only against this provider's upcoming stored contests so that
    // a failure in another provider has no effect on the diff.
    const previous = getUpcomingStoredContestsByPlatform(provider.platform);
    const changes = reconcileContests(previous, validContests);

    // Persist the fresh data for this provider.
    saveContests(validContests);

    // Remove upcoming contests for this platform that the provider no longer
    // returns. This only runs because the fetch succeeded, so it is safe.
    const currentIds = new Set(validContests.map((c) => c.id));
    const removed = removeStaleUpcomingContests(provider.platform, currentIds);

    if (removed > 0) {
      console.log(`Removed ${removed} stale ${provider.platform} contest(s).`);
    }

    allContests.push(...validContests);
    allChanges.push(...changes);
  });

  return {
    contests: allContests,
    changes: allChanges,
    failedProviders,
  };
}
