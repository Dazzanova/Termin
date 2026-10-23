import type { ContestPlatform } from "../contests/types";

export type UserPreferences = {
  enabledPlatforms: ContestPlatform[];
  maxContestsPerWeek: number;
  preferredDays: number[]; // 0-6, where 0 is Sunday
  preferredTimeWindows: { start: number; end: number }[]; // hours 0-23
  platformWeights: Partial<Record<ContestPlatform, number>>;
};

export const SUPPORTED_PLATFORMS: readonly ContestPlatform[] = [
  "codeforces",
  "atcoder",
  "codechef",
  "leetcode",
] as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  enabledPlatforms: [...SUPPORTED_PLATFORMS],
  maxContestsPerWeek: 5,
  preferredDays: [1, 2, 3, 4, 5], // Weekdays
  preferredTimeWindows: [{ start: 18, end: 23 }], // Evening
  platformWeights: {},
};
