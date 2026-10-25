import type { ContestPlatform } from "./types";

export const PLATFORM_NAMES: Record<ContestPlatform, string> = {
  codeforces: "Codeforces",
  atcoder: "AtCoder",
  codechef: "CodeChef",
  leetcode: "LeetCode",
};

export const PLATFORM_MONOGRAMS: Record<ContestPlatform, string> = {
  codeforces: "CF",
  atcoder: "AT",
  codechef: "CC",
  leetcode: "LC",
};

export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform as ContestPlatform] ?? platform;
}

export function platformMonogram(platform: string): string {
  return (
    PLATFORM_MONOGRAMS[platform as ContestPlatform] ??
    platform.slice(0, 2).toUpperCase()
  );
}
