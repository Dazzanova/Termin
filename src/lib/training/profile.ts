import type { Problem, RatingEntry, Submission } from "./types";

export const MIN_TAG_SAMPLE = 3;
export const DISPLAY_TAGS = 5;
export const SUGGESTION_TAGS = 3;
export const SUGGESTION_LIMIT = 5;
export const BAND_CEILING = 200;
export const BAND_FLOOR_FALLBACK = -150;
export const RATING_SERIES_LIMIT = 20;

export type TagStat = {
  tag: string;
  attempted: number;
  solved: number;
  solveRate: number;
  medianSolvedRating: number | null;
};

export type Anchor = {
  value: number | null;
  source: "rating" | "solved" | null;
};

export type ProblemSuggestion = {
  problem: Problem;
  tag: string;
};

export type RatingPoint = RatingEntry & {
  delta: number;
};

export type RatingSummary = {
  current: number | null;
  peak: number | null;
  contests: number;
  lastDelta: number | null;
  series: RatingPoint[];
};

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Ranks tags by how poorly they are going: lowest solve rate first, then the
 * lowest rating you manage to solve in that tag. Tags with fewer than
 * MIN_TAG_SAMPLE attempts are ignored so one stray problem cannot define a
 * weakness.
 */
export function buildWeaknessProfile(
  problems: Problem[],
  submissions: Submission[]
): TagStat[] {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const attempted = new Map<string, Set<string>>();
  const solved = new Map<string, Set<string>>();

  for (const submission of submissions) {
    const problem = byId.get(submission.problemId);

    if (!problem) {
      continue;
    }

    for (const tag of problem.tags) {
      if (!attempted.has(tag)) {
        attempted.set(tag, new Set());
      }
      attempted.get(tag)?.add(problem.id);

      if (submission.verdict === "OK") {
        if (!solved.has(tag)) {
          solved.set(tag, new Set());
        }
        solved.get(tag)?.add(problem.id);
      }
    }
  }

  const stats: TagStat[] = [];

  for (const [tag, attemptedIds] of attempted) {
    if (attemptedIds.size < MIN_TAG_SAMPLE) {
      continue;
    }

    const solvedIds = solved.get(tag) ?? new Set<string>();
    const solvedRatings = [...solvedIds]
      .map((id) => byId.get(id)?.rating)
      .filter((value): value is number => value !== null && value !== undefined);

    stats.push({
      tag,
      attempted: attemptedIds.size,
      solved: solvedIds.size,
      solveRate: solvedIds.size / attemptedIds.size,
      medianSolvedRating: median(solvedRatings),
    });
  }

  return stats.sort((a, b) => {
    if (a.solveRate !== b.solveRate) {
      return a.solveRate - b.solveRate;
    }

    if (a.medianSolvedRating !== b.medianSolvedRating) {
      if (a.medianSolvedRating === null) {
        return 1;
      }
      if (b.medianSolvedRating === null) {
        return -1;
      }
      return a.medianSolvedRating - b.medianSolvedRating;
    }

    if (a.attempted !== b.attempted) {
      return b.attempted - a.attempted;
    }

    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Chooses where "near your rating" starts. Rated handles use the current
 * rating; everyone else gets the 75th percentile of solved problem ratings,
 * rounded to the nearest 100 with a floor of 800.
 */
export function resolveAnchor(input: {
  currentRating: number | null;
  problems: Problem[];
  submissions: Submission[];
}): Anchor {
  if (input.currentRating !== null) {
    return { value: input.currentRating, source: "rating" };
  }

  const byId = new Map(input.problems.map((problem) => [problem.id, problem]));
  const solvedIds = new Set(
    input.submissions
      .filter((submission) => submission.verdict === "OK")
      .map((submission) => submission.problemId)
  );

  const ratings = [...solvedIds]
    .map((id) => byId.get(id)?.rating)
    .filter((value): value is number => value !== null && value !== undefined)
    .sort((a, b) => a - b);

  if (ratings.length === 0) {
    return { value: null, source: null };
  }

  const rank = Math.min(
    ratings.length - 1,
    Math.max(0, Math.ceil(ratings.length * 0.75) - 1)
  );
  const value = Math.max(800, Math.round(ratings[rank] / 100) * 100);

  return { value, source: "solved" };
}

/**
 * Picks unsolved, untracked problems from the weakest tags inside
 * [anchor, anchor + BAND_CEILING]. If that band is thin, the floor drops once
 * to anchor - 150; the ceiling never rises. Problems are round-robined across
 * tags so one tag cannot fill the list.
 */
export function buildSuggestions(input: {
  problems: Problem[];
  submissions: Submission[];
  trackedProblemIds: Set<string>;
  weakTags: TagStat[];
  anchor: number | null;
  limit?: number;
}): ProblemSuggestion[] {
  const {
    problems,
    submissions,
    trackedProblemIds,
    weakTags,
    anchor,
  } = input;
  const limit = input.limit ?? SUGGESTION_LIMIT;

  if (anchor === null || weakTags.length === 0) {
    return [];
  }

  const attempted = new Set(
    submissions.map((submission) => submission.problemId)
  );
  const tags = weakTags.slice(0, SUGGESTION_TAGS);
  const ceiling = anchor + BAND_CEILING;

  const collect = (floor: number): ProblemSuggestion[] => {
    const matches: ProblemSuggestion[] = [];

    for (const problem of problems) {
      if (problem.rating === null) {
        continue;
      }
      if (problem.rating < floor || problem.rating > ceiling) {
        continue;
      }
      if (attempted.has(problem.id) || trackedProblemIds.has(problem.id)) {
        continue;
      }

      const tag = tags.find((entry) => problem.tags.includes(entry.tag));

      if (tag) {
        matches.push({ problem, tag: tag.tag });
      }
    }

    return matches;
  };

  let pool = collect(anchor);

  if (pool.length < limit) {
    pool = collect(Math.max(0, anchor + BAND_FLOOR_FALLBACK));
  }

  const groups = tags.map((tag) =>
    pool
      .filter((entry) => entry.tag === tag.tag)
      .sort(
        (a, b) =>
          (a.problem.rating ?? 0) - (b.problem.rating ?? 0) ||
          a.problem.id.localeCompare(b.problem.id)
      )
  );

  const picked: ProblemSuggestion[] = [];
  const seen = new Set<string>();
  let advanced = true;

  while (picked.length < limit && advanced) {
    advanced = false;

    for (const group of groups) {
      const next = group.find((entry) => !seen.has(entry.problem.id));

      if (!next) {
        continue;
      }

      seen.add(next.problem.id);
      picked.push(next);
      advanced = true;

      if (picked.length === limit) {
        break;
      }
    }
  }

  return picked;
}

export function buildRatingSummary(
  rows: RatingEntry[],
  limit = RATING_SERIES_LIMIT
): RatingSummary {
  if (rows.length === 0) {
    return {
      current: null,
      peak: null,
      contests: 0,
      lastDelta: null,
      series: [],
    };
  }

  const last = rows[rows.length - 1];

  return {
    current: last.newRating,
    peak: Math.max(...rows.map((row) => row.newRating)),
    contests: rows.length,
    lastDelta: last.newRating - last.oldRating,
    series: rows.slice(-limit).map((row) => ({
      ...row,
      delta: row.newRating - row.oldRating,
    })),
  };
}
