import type { Contest, ContestPlatform } from "./types";

const SUPPORTED_PLATFORMS: ReadonlySet<string> = new Set<ContestPlatform>([
  "codeforces",
  "atcoder",
  "codechef",
  "leetcode",
]);

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateContest(contest: Contest): boolean {
  if (!contest.id || contest.id.trim().length === 0) {
    return false;
  }

  if (!SUPPORTED_PLATFORMS.has(contest.platform)) {
    return false;
  }

  if (!contest.name || contest.name.trim().length === 0) {
    return false;
  }

  if (!(contest.startTime instanceof Date) || Number.isNaN(contest.startTime.getTime())) {
    return false;
  }

  if (!Number.isFinite(contest.durationSeconds) || contest.durationSeconds <= 0) {
    return false;
  }

  if (!isValidUrl(contest.url)) {
    return false;
  }

  return true;
}

export function validateContests(contests: Contest[]): Contest[] {
  return contests.filter(validateContest);
}
