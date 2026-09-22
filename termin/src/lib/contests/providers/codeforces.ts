import type { Contest } from "../types";

type CodeforcesContest = {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
  durationSeconds: number;
};

export async function getCodeforcesContests(): Promise<Contest[]> {
  const response = await fetch(
    "https://codeforces.com/api/contest.list?gym=false"
  );

  if (!response.ok) {
    throw new Error(`Codeforces API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK") {
    throw new Error(data.comment ?? "Codeforces API request failed");
  }

  return (data.result as CodeforcesContest[])
    .filter(
      (contest) =>
        contest.phase === "BEFORE" &&
        contest.startTimeSeconds !== undefined
    )
    .map((contest) => ({
      id: `codeforces:${contest.id}`,
      platform: "codeforces",
      name: contest.name,
      startTime: new Date(contest.startTimeSeconds * 1000),
      durationSeconds: contest.durationSeconds,
      url: `https://codeforces.com/contest/${contest.id}`,
    }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
