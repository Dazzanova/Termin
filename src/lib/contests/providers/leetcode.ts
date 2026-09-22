import type { Contest } from "../types";

type LeetCodeContest = {
  title: string;
  titleSlug: string;
  startTime: number;
  duration: number;
};

type LeetCodeResponse = {
  data?: {
    allContests?: LeetCodeContest[];
  };
  errors?: Array<{
    message: string;
  }>;
};

const LEETCODE_URL = "https://leetcode.com/graphql";

const QUERY = `
  query getUpcomingContests {
    allContests {
      title
      titleSlug
      startTime
      duration
    }
  }
`;

export async function getLeetCodeContests(): Promise<Contest[]> {
  const response = await fetch(LEETCODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      operationName: "getUpcomingContests",
      query: QUERY,
      variables: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode returned ${response.status}`);
  }

  const data = (await response.json()) as LeetCodeResponse;

  if (data.errors?.length) {
    throw new Error(data.errors[0].message);
  }

  if (!data.data?.allContests) {
    throw new Error("LeetCode returned no contest data");
  }

  const now = Date.now();

  return data.data.allContests
    .filter((contest) => contest.startTime * 1000 > now)
    .map((contest) => ({
      id: `leetcode:${contest.titleSlug}`,
      platform: "leetcode",
      name: contest.title,
      startTime: new Date(contest.startTime * 1000),
      durationSeconds: contest.duration,
      url: `https://leetcode.com/contest/${contest.titleSlug}/`,
    }));
}
