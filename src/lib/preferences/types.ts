import type { ContestPlatform } from "../contests/types";

export type UserPreferences = {
  enabledPlatforms: ContestPlatform[];
};

export const SUPPORTED_PLATFORMS: readonly ContestPlatform[] = [
  "codeforces",
  "atcoder",
  "codechef",
  "leetcode",
] as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  enabledPlatforms: [...SUPPORTED_PLATFORMS],
};
