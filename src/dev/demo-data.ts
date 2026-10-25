import type {
  Contest,
  ContestPlatform,
  ParticipationStatus,
} from "../lib/contests/types";
import type { UserPreferences } from "../lib/preferences/types";
import type {
  Problem,
  ProblemReview,
  Submission,
} from "../lib/training/types";

/**
 * Fixtures for `npm run demo`. Every timestamp is relative to the moment the
 * demo is seeded, so the data never goes stale: upcoming contests are always
 * upcoming and history is always in the past.
 */

type UpcomingFixture = {
  id: string;
  platform: ContestPlatform;
  name: string;
  url: string;
  inDays: number;
  hour: number;
  minute: number;
  durationSeconds: number;
  status?: ParticipationStatus;
};

type HistoryFixture = {
  id: string;
  platform: ContestPlatform;
  name: string;
  url: string;
  daysAgo: number;
  hour: number;
  minute: number;
  durationSeconds: number;
  status: ParticipationStatus;
};

const UPCOMING: UpcomingFixture[] = [
  {
    id: "codeforces:demo-1001",
    platform: "codeforces",
    name: "Codeforces Round 1001 (Div. 2)",
    url: "https://codeforces.com/contest/1001",
    inDays: 1,
    hour: 20,
    minute: 5,
    durationSeconds: 7200,
  },
  {
    id: "codechef:demo-start263",
    platform: "codechef",
    name: "Starters 263",
    url: "https://www.codechef.com/START263",
    inDays: 2,
    hour: 20,
    minute: 0,
    durationSeconds: 7200,
    status: "planned",
  },
  {
    id: "atcoder:demo-abc392",
    platform: "atcoder",
    name: "AtCoder Beginner Contest 392",
    url: "https://atcoder.jp/contests/abc392",
    inDays: 3,
    hour: 18,
    minute: 0,
    durationSeconds: 6000,
    status: "planned",
  },
  {
    // Deliberately overlaps the AtCoder contest above, so Planning shows the
    // "Overlaps a contest you planned" warning.
    id: "leetcode:demo-weekly-527",
    platform: "leetcode",
    name: "Weekly Contest 527",
    url: "https://leetcode.com/contest/weekly-contest-527/",
    inDays: 3,
    hour: 18,
    minute: 15,
    durationSeconds: 5400,
    status: "planned",
  },
  {
    id: "codeforces:demo-1002",
    platform: "codeforces",
    name: "Codeforces Round 1002 (Div. 3)",
    url: "https://codeforces.com/contest/1002",
    inDays: 5,
    hour: 20,
    minute: 5,
    durationSeconds: 8100,
  },
  {
    id: "codechef:demo-dsa027",
    platform: "codechef",
    name: "Starters 264",
    url: "https://www.codechef.com/START264",
    inDays: 1,
    hour: 21,
    minute: 0,
    durationSeconds: 10800,
  },
  {
    id: "atcoder:demo-arc201",
    platform: "atcoder",
    name: "AtCoder Regular Contest 201",
    url: "https://atcoder.jp/contests/arc201",
    inDays: 9,
    hour: 18,
    minute: 0,
    durationSeconds: 9000,
  },
];

const HISTORY: HistoryFixture[] = [
  {
    id: "codeforces:demo-h1",
    platform: "codeforces",
    name: "Codeforces Round 998 (Div. 2)",
    url: "https://codeforces.com/contest/998",
    daysAgo: 2,
    hour: 20,
    minute: 5,
    durationSeconds: 7200,
    status: "participated",
  },
  {
    id: "leetcode:demo-h2",
    platform: "leetcode",
    name: "Weekly Contest 525",
    url: "https://leetcode.com/contest/weekly-contest-525/",
    daysAgo: 3,
    hour: 8,
    minute: 0,
    durationSeconds: 5400,
    status: "planned",
  },
  {
    id: "atcoder:demo-h3",
    platform: "atcoder",
    name: "AtCoder Beginner Contest 390",
    url: "https://atcoder.jp/contests/abc390",
    daysAgo: 4,
    hour: 18,
    minute: 0,
    durationSeconds: 6000,
    status: "participated",
  },
  {
    id: "codechef:demo-h4",
    platform: "codechef",
    name: "Starters 261",
    url: "https://www.codechef.com/START261",
    daysAgo: 5,
    hour: 20,
    minute: 0,
    durationSeconds: 7200,
    status: "skipped",
  },
  {
    id: "codeforces:demo-h5",
    platform: "codeforces",
    name: "Codeforces Round 997 (Div. 1 + Div. 2)",
    url: "https://codeforces.com/contest/997",
    daysAgo: 7,
    hour: 20,
    minute: 5,
    durationSeconds: 7200,
    status: "participated",
  },
  {
    id: "leetcode:demo-h6",
    platform: "leetcode",
    name: "Biweekly Contest 193",
    url: "https://leetcode.com/contest/biweekly-contest-193/",
    daysAgo: 9,
    hour: 8,
    minute: 0,
    durationSeconds: 5400,
    status: "participated",
  },
  {
    id: "atcoder:demo-h7",
    platform: "atcoder",
    name: "AtCoder Beginner Contest 389",
    url: "https://atcoder.jp/contests/abc389",
    daysAgo: 11,
    hour: 18,
    minute: 0,
    durationSeconds: 6000,
    status: "planned",
  },
  {
    id: "codechef:demo-h8",
    platform: "codechef",
    name: "Starters 259",
    url: "https://www.codechef.com/START259",
    daysAgo: 12,
    hour: 20,
    minute: 0,
    durationSeconds: 10800,
    status: "participated",
  },
  {
    id: "codeforces:demo-h9",
    platform: "codeforces",
    name: "Educational Codeforces Round 176",
    url: "https://codeforces.com/contest/1760",
    daysAgo: 14,
    hour: 20,
    minute: 5,
    durationSeconds: 7200,
    status: "participated",
  },
  {
    id: "leetcode:demo-h10",
    platform: "leetcode",
    name: "Weekly Contest 523",
    url: "https://leetcode.com/contest/weekly-contest-523/",
    daysAgo: 16,
    hour: 8,
    minute: 0,
    durationSeconds: 5400,
    status: "skipped",
  },
  {
    id: "codechef:demo-h11",
    platform: "codechef",
    name: "DSA Challenge 024 (Rated)",
    url: "https://www.codechef.com/DSACHALLENGE024",
    daysAgo: 18,
    hour: 20,
    minute: 0,
    durationSeconds: 7200,
    status: "participated",
  },
  {
    id: "atcoder:demo-h12",
    platform: "atcoder",
    name: "AtCoder Beginner Contest 387",
    url: "https://atcoder.jp/contests/abc387",
    daysAgo: 20,
    hour: 18,
    minute: 0,
    durationSeconds: 6000,
    status: "participated",
  },
  {
    id: "codeforces:demo-h13",
    platform: "codeforces",
    name: "Codeforces Round 995 (Div. 2)",
    url: "https://codeforces.com/contest/995",
    daysAgo: 23,
    hour: 20,
    minute: 5,
    durationSeconds: 7200,
    status: "participated",
  },
  {
    id: "leetcode:demo-h14",
    platform: "leetcode",
    name: "Biweekly Contest 191",
    url: "https://leetcode.com/contest/biweekly-contest-191/",
    daysAgo: 25,
    hour: 8,
    minute: 0,
    durationSeconds: 5400,
    status: "planned",
  },
];

export const DEMO_PREFERENCES: UserPreferences = {
  enabledPlatforms: ["codeforces", "atcoder", "codechef", "leetcode"],
  maxContestsPerWeek: 5,
  preferredDays: [1, 2, 3, 4, 5],
  preferredTimeWindows: [{ start: 18, end: 23 }],
  platformWeights: {
    codeforces: 20,
    atcoder: 15,
    codechef: 12,
    leetcode: 8,
  },
};

const TRAINING_HANDLE = "termin_demo";

/** Problems for the demo's past Codeforces contests (demo-h1/h5/h9/h13). */
const TRAINING_PROBLEMS: {
  contestId: string;
  index: string;
  name: string;
  rating: number;
  tags: string[];
}[] = [
  {
    contestId: "demo-h1",
    index: "A",
    name: "Array Cloning",
    rating: 800,
    tags: ["implementation"],
  },
  {
    contestId: "demo-h1",
    index: "B",
    name: "Card Game",
    rating: 1200,
    tags: ["games", "greedy"],
  },
  {
    contestId: "demo-h1",
    index: "C",
    name: "Tree Cutting",
    rating: 1800,
    tags: ["trees", "dfs and similar"],
  },
  {
    contestId: "demo-h5",
    index: "A",
    name: "Two Permutations",
    rating: 900,
    tags: ["constructive algorithms"],
  },
  {
    contestId: "demo-h5",
    index: "B",
    name: "Prefix Sums",
    rating: 1300,
    tags: ["dp"],
  },
  {
    contestId: "demo-h5",
    index: "C",
    name: "Shortest Path",
    rating: 1700,
    tags: ["graphs", "shortest paths"],
  },
  {
    contestId: "demo-h9",
    index: "A",
    name: "Binary Search",
    rating: 1000,
    tags: ["binary search"],
  },
  {
    contestId: "demo-h9",
    index: "B",
    name: "Grid Walk",
    rating: 1400,
    tags: ["dp", "grids"],
  },
  {
    contestId: "demo-h9",
    index: "C",
    name: "Cost Flow",
    rating: 1900,
    tags: ["flows"],
  },
  {
    contestId: "demo-h13",
    index: "A",
    name: "String Shift",
    rating: 800,
    tags: ["strings"],
  },
  {
    contestId: "demo-h13",
    index: "B",
    name: "Range Queries",
    rating: 1500,
    tags: ["data structures"],
  },
  {
    contestId: "demo-h13",
    index: "C",
    name: "Cycle Count",
    rating: 2000,
    tags: ["graphs"],
  },
];

/** Overdue first, then a handful spread over the coming days. */
const TRAINING_REVIEWS: { problemId: string; daysFromNow: number }[] = [
  { problemId: "codeforces:demo-h1B", daysFromNow: -1 },
  { problemId: "codeforces:demo-h1C", daysFromNow: -0.2 },
  { problemId: "codeforces:demo-h5B", daysFromNow: -3 },
  { problemId: "codeforces:demo-h5C", daysFromNow: 1 },
  { problemId: "codeforces:demo-h9B", daysFromNow: 2 },
  { problemId: "codeforces:demo-h9C", daysFromNow: 2 },
  { problemId: "codeforces:demo-h13B", daysFromNow: 4 },
  { problemId: "codeforces:demo-h13C", daysFromNow: 5 },
];

export type DemoTraining = {
  handle: string;
  problems: Problem[];
  submissions: Submission[];
  reviews: ProblemReview[];
};

export type DemoDataset = {
  contests: Contest[];
  participation: { contestId: string; status: ParticipationStatus }[];
  preferences: UserPreferences;
  training: DemoTraining;
};

function buildTraining(now: Date): DemoTraining {
  const problems: Problem[] = TRAINING_PROBLEMS.map((problem) => ({
    id: `codeforces:${problem.contestId}${problem.index}`,
    platform: "codeforces",
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    tags: problem.tags,
    url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
  }));

  // One accepted problem per contest, so the queue is not uniformly unsolved.
  const solved = problems.filter((problem) => problem.index === "A");
  const submissions: Submission[] = solved.map((problem, index) => ({
    id: `codeforces:demo-submission-${index + 1}`,
    platform: "codeforces",
    problemId: problem.id,
    verdict: "OK",
    submittedAt: new Date(now.getTime() - (index + 2) * 86_400_000),
  }));

  const reviews: ProblemReview[] = TRAINING_REVIEWS.map((entry) => {
    const dueAt = new Date(now.getTime() + entry.daysFromNow * 86_400_000);

    return {
      problemId: entry.problemId,
      status: entry.daysFromNow < 0 ? "due" : "scheduled",
      dueAt,
      intervalDays: entry.daysFromNow < 0 ? 1 : Math.max(1, entry.daysFromNow),
      attempts: 0,
      updatedAt: now,
    };
  });

  return { handle: TRAINING_HANDLE, problems, submissions, reviews };
}

function futureStart(
  now: Date,
  inDays: number,
  hour: number,
  minute: number
): Date {
  const start = new Date(now);
  start.setDate(start.getDate() + inDays);
  start.setHours(hour, minute, 0, 0);

  // Fixtures are relative, so keep them upcoming even around midnight.
  while (start.getTime() <= now.getTime()) {
    start.setDate(start.getDate() + 1);
  }

  return start;
}

function pastStart(
  now: Date,
  daysAgo: number,
  hour: number,
  minute: number
): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - daysAgo);
  start.setHours(hour, minute, 0, 0);
  return start;
}

export function buildDemoDataset(now: Date = new Date()): DemoDataset {
  const contests: Contest[] = [];
  const participation: DemoDataset["participation"] = [];

  for (const fixture of UPCOMING) {
    contests.push({
      id: fixture.id,
      platform: fixture.platform,
      name: fixture.name,
      url: fixture.url,
      durationSeconds: fixture.durationSeconds,
      startTime: futureStart(
        now,
        fixture.inDays,
        fixture.hour,
        fixture.minute
      ),
    });

    if (fixture.status) {
      participation.push({ contestId: fixture.id, status: fixture.status });
    }
  }

  for (const fixture of HISTORY) {
    contests.push({
      id: fixture.id,
      platform: fixture.platform,
      name: fixture.name,
      url: fixture.url,
      durationSeconds: fixture.durationSeconds,
      startTime: pastStart(
        now,
        fixture.daysAgo,
        fixture.hour,
        fixture.minute
      ),
    });

    participation.push({ contestId: fixture.id, status: fixture.status });
  }

  return {
    contests,
    participation,
    preferences: {
      ...DEMO_PREFERENCES,
      enabledPlatforms: [...DEMO_PREFERENCES.enabledPlatforms],
    },
    training: buildTraining(now),
  };
}
