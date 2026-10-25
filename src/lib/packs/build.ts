import { PLATFORM_MONOGRAMS, PLATFORM_NAMES } from "../contests/platforms";
import { SUPPORTED_PLATFORMS } from "../preferences/types";
import type { Contest, ContestPlatform } from "../contests/types";
import type { Problem } from "../training/types";

export type PackFile = {
  name: string;
  contents: string;
};

export type Pack = {
  id: string;
  platform: ContestPlatform;
  title: string;
  subtitle: string;
  folder: string;
  files: PackFile[];
};

/** The letters a contest of each platform usually asks, used when we have no catalog data. */
export const PACK_FILE_SETS: Record<ContestPlatform, string[]> = {
  codeforces: ["A", "B", "C", "D", "E"],
  atcoder: ["A", "B", "C", "D", "E", "F", "G"],
  codechef: ["A", "B", "C", "D", "E", "F"],
  leetcode: ["P1", "P2", "P3", "P4"],
};

type ResolvedProblem = {
  index: string;
  name?: string;
  url?: string;
};

function slug(value: string, fallback: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
}

function durationLabel(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function fileLabel(platform: ContestPlatform, index: string): string {
  return platform === "leetcode"
    ? `Problem ${index.slice(1)}`
    : `Problem ${index}`;
}

const INCLUDE_LINE = "#include <bits/stdc++.h>";

/**
 * One C++17 skeleton per problem. The header is the only difference between
 * files, so a pack opens as a stack of near-identical buffers you can start
 * typing into without setup.
 */
export function cppTemplate(input: {
  heading: string;
  url?: string;
  context?: string;
  note?: string;
}): string {
  const header = [`// ${input.heading}`];

  if (input.url) {
    header.push(`// ${input.url}`);
  }

  if (input.context) {
    header.push(`// ${input.context}`);
  }

  if (input.note) {
    header.push("//", `// ${input.note}`);
  }

  return [
    ...header,
    "",
    INCLUDE_LINE,
    "using namespace std;",
    "",
    "int main() {",
    "    ios::sync_with_stdio(false);",
    "    cin.tie(nullptr);",
    "",
    "    // TODO",
    "",
    "    return 0;",
    "}",
    "",
  ].join("\n");
}

function resolveProblems(
  contest: Contest,
  problems: Problem[]
): ResolvedProblem[] {
  const letters = PACK_FILE_SETS[contest.platform];

  if (contest.platform === "codeforces") {
    const contestKey = contest.id.split(":")[1];
    const matches = problems
      .filter(
        (problem) =>
          problem.platform === "codeforces" &&
          problem.contestId === contestKey
      )
      .sort((a, b) => a.index.localeCompare(b.index, "en"));

    if (matches.length > 0) {
      return matches.map((problem) => ({
        index: problem.index,
        name: problem.name,
        url: problem.url,
      }));
    }
  }

  return letters.map((index) => ({ index }));
}

export function buildPack(contest: Contest, problems: Problem[]): Pack {
  const resolved = resolveProblems(contest, problems);
  const platform = contest.platform;
  const suffix = slug(contest.id.split(":")[1] ?? "", "contest");

  return {
    id: `contest-${slug(contest.id, "contest")}`,
    platform,
    title: contest.name,
    subtitle: `${durationLabel(contest.durationSeconds)} · ${resolved.length} ${
      resolved.length === 1 ? "file" : "files"
    }`,
    folder: `termin-${PLATFORM_MONOGRAMS[platform].toLowerCase()}-${suffix}`,
    files: resolved.map((problem) => ({
      name: `${problem.index.toLowerCase()}.cpp`,
      contents: cppTemplate({
        heading:
          problem.name ?? fileLabel(platform, problem.index),
        url: problem.url ?? contest.url,
        context: contest.name,
      }),
    })),
  };
}

export function buildGenericPack(platform: ContestPlatform): Pack {
  const label = PLATFORM_NAMES[platform];
  const letters = PACK_FILE_SETS[platform];

  return {
    id: `platform-${platform}`,
    platform,
    title: `Any ${label} contest`,
    subtitle: `Starter template · ${letters.length} files`,
    folder: `termin-${PLATFORM_MONOGRAMS[platform].toLowerCase()}-template`,
    files: letters.map((index) => ({
      name: `${index.toLowerCase()}.cpp`,
      contents: cppTemplate({
        heading: `${label} contest template`,
        note: `One file per problem. Start with ${letters[0].toLowerCase()}.cpp, then work up.`,
      }),
    })),
  };
}

/**
 * Upcoming contests first, soonest first, then one generic pack per platform.
 * The page and the zip endpoint both call this, so the two cannot drift.
 */
export function listPacks(contests: Contest[], problems: Problem[]): Pack[] {
  const upcoming = [...contests].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  return [
    ...upcoming.map((contest) => buildPack(contest, problems)),
    ...SUPPORTED_PLATFORMS.map((platform) => buildGenericPack(platform)),
  ];
}
