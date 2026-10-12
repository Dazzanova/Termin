export type ContestPlatform =
  | "codeforces"
  | "atcoder"
  | "codechef"
  | "leetcode";

export type ParticipationStatus = "planned" | "participated" | "skipped";

export type Contest = {
  id: string;
  platform: ContestPlatform;
  name: string;
  startTime: Date;
  durationSeconds: number;
  url: string;
};
