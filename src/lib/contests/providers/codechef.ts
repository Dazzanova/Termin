import type { Contest } from "../types";

type CodeChefContest = {
  contest_id: string;
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string;
  contest_duration: string;
};

type CodeChefResponse = {
  status: string;
  future_contests: CodeChefContest[];
};

const CODECHEF_URL =
  "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all";

export async function getCodeChefContests(): Promise<Contest[]> {
  const response = await fetch(CODECHEF_URL);

  if (!response.ok) {
    throw new Error(`CodeChef returned ${response.status}`);
  }

  const data = (await response.json()) as CodeChefResponse;

  if (data.status !== "success") {
    throw new Error("CodeChef API request failed");
  }

  return data.future_contests.map((contest) => ({
    id: `codechef:${contest.contest_code}`,
    platform: "codechef",
    name: contest.contest_name,
    startTime: new Date(contest.contest_start_date_iso),
    durationSeconds: Number(contest.contest_duration) * 60,
    url: `https://www.codechef.com/${contest.contest_code}`,
  }));
}
