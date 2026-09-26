import type { Contest, ContestPlatform } from "./types";
import { validateProviderContests } from "./validate";
import { reconcileContests, type ContestChange } from "./reconcile";
import {
  getUpcomingStoredContestsByPlatform,
  syncProviderContests,
} from "./repository";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeChefContests } from "./providers/codechef";
import { getCodeforcesContests } from "./providers/codeforces";
import { getLeetCodeContests } from "./providers/leetcode";
import {
  markProviderFailure,
  markProviderSuccess,
  markSyncCompleted,
  markSyncStarted,
} from "./sync-state";
import { scheduleReminders } from "../reminders/schedule";

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
  markSyncStarted();

  const allContests: Contest[] = [];
  const allChanges: ContestChange[] = [];
  const failedProviders: string[] = [];

  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  results.forEach((result, index) => {
    const provider = providers[index];

    if (result.status === "rejected") {
      failedProviders.push(provider.platform);

      markProviderFailure(provider.platform, result.reason);

      console.error(
        `Failed to fetch ${provider.platform} contests:`,
        result.reason
      );

      return;
    }

    const validation = validateProviderContests(
      result.value,
      provider.platform
    );

    if (validation.invalidCount > 0) {
      console.error(
        `${provider.platform} returned ${validation.invalidCount} invalid contest(s); preserving existing data`
      );

      return;
    }

    const validContests = validation.contests;

    const previous = getUpcomingStoredContestsByPlatform(
      provider.platform
    );

    const changes = reconcileContests(
      previous,
      validContests
    );

    const removed = syncProviderContests(
      provider.platform,
      validContests
    );

    for (const contest of validContests) {
      scheduleReminders(contest);
    }

    markProviderSuccess(provider.platform);

    if (removed > 0) {
      console.log(
        `Removed ${removed} stale ${provider.platform} contest(s).`
      );
    }

    allContests.push(...validContests);
    allChanges.push(...changes);
  });

  markSyncCompleted();

  return {
    contests: allContests,
    changes: allChanges,
    failedProviders,
  };
}
