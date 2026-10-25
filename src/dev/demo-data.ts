import type {
  Contest,
  ContestPlatform,
  ParticipationStatus,
} from "../lib/contests/types";
import type { UserPreferences } from "../lib/preferences/types";

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

export type DemoDataset = {
  contests: Contest[];
  participation: { contestId: string; status: ParticipationStatus }[];
  preferences: UserPreferences;
};

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
  };
}
