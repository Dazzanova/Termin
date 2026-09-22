import type { Contest } from "./types";

export function validateContest(contest: Contest): boolean {
  return (
    contest.id.length > 0 &&
    contest.platform.length > 0 &&
    contest.name.length > 0 &&
    !Number.isNaN(contest.startTime.getTime()) &&
    contest.durationSeconds > 0 &&
    contest.url.length > 0
  );
}

export function validateContests(contests: Contest[]): Contest[] {
  return contests.filter(validateContest);
}
