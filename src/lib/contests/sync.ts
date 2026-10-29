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
  await markSyncStarted();

  const allContests: Contest[] = [];
  const allChanges: ContestChange[] = [];
  const failedProviders: string[] = [];

  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  for (const [index, result] of results.entries()) {
    const provider = providers[index];

    if (result.status === "rejected") {
      failedProviders.push(provider.platform);

      await markProviderFailure(provider.platform, result.reason);

      console.error(
        `Failed to fetch ${provider.platform} contests:`,
        result.reason
      );

      continue;
    }

    const validation = validateProviderContests(
      result.value,
      provider.platform
    );

    if (validation.invalidCount > 0) {
      failedProviders.push(provider.platform);

      await markProviderFailure(
        provider.platform,
        new Error(`${validation.invalidCount} invalid contest(s)`)
      );

      console.error(
        `${provider.platform} returned ${validation.invalidCount} invalid contest(s); preserving existing data`
      );

      continue;
    }

    const validContests = validation.contests;

    const previous = await getUpcomingStoredContestsByPlatform(
      provider.platform
    );

    const changes = reconcileContests(
      previous,
      validContests
    );

    const removed = await syncProviderContests(
      provider.platform,
      validContests
    );

    for (const contest of validContests) {
      await scheduleReminders(contest);
    }

    await markProviderSuccess(provider.platform);

    if (removed > 0) {
      console.log(
        `Removed ${removed} stale ${provider.platform} contest(s).`
      );
    }

    allContests.push(...validContests);
    allChanges.push(...changes);
  }

  await markSyncCompleted(failedProviders.length === 0);

  return {
    contests: allContests,
    changes: allChanges,
    failedProviders,
  };
}
