import type { Problem, Submission } from "../training/types";

const API_ROOT = "https://codeforces.com/api";
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_INTERVAL_MS = 500; // the API allows two requests per second

type ApiEnvelope<T> = {
  status: "OK" | "FAILED";
  result?: T;
  comment?: string;
};

type ProblemsetResult = {
  problems: {
    contestId?: number;
    index: string;
    name: string;
    rating?: number;
    tags?: string[];
  }[];
};

type SubmissionResult = {
  id: number;
  contestId?: number;
  problem: { index: string };
  verdict?: string;
  creationTimeSeconds: number;
}[];

export class CodeforcesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeforcesError";
  }
}

let lastRequestAt = 0;

async function call<T>(
  method: string,
  params: Record<string, string> = {}
): Promise<T> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  lastRequestAt = Date.now();

  const url = new URL(`${API_ROOT}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CodeforcesError(`Could not reach Codeforces: ${reason}`);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new CodeforcesError(
      `Codeforces returned a non-JSON response (${response.status})`
    );
  }

  if (envelope.status !== "OK" || envelope.result === undefined) {
    throw new CodeforcesError(
      envelope.comment ?? "Codeforces rejected the request"
    );
  }

  return envelope.result;
}

/** Problems without a contest id (acmsguru) are not tied to a contest, so skip them. */
export function mapProblemset(result: ProblemsetResult): Problem[] {
  const problems: Problem[] = [];

  for (const entry of result.problems) {
    if (entry.contestId === undefined) {
      continue;
    }

    problems.push({
      id: `codeforces:${entry.contestId}${entry.index}`,
      platform: "codeforces",
      contestId: String(entry.contestId),
      index: entry.index,
      name: entry.name,
      rating: entry.rating ?? null,
      tags: entry.tags ?? [],
      url: `https://codeforces.com/problemset/problem/${entry.contestId}/${entry.index}`,
    });
  }

  return problems;
}

export function mapSubmissions(result: SubmissionResult): Submission[] {
  const submissions: Submission[] = [];

  for (const entry of result) {
    if (entry.contestId === undefined || !entry.verdict) {
      continue;
    }

    submissions.push({
      id: `codeforces:${entry.id}`,
      platform: "codeforces",
      problemId: `codeforces:${entry.contestId}${entry.problem.index}`,
      verdict: entry.verdict,
      submittedAt: new Date(entry.creationTimeSeconds * 1000),
    });
  }

  return submissions;
}

export async function fetchProblemset(): Promise<Problem[]> {
  const result = await call<ProblemsetResult>("problemset.problems");
  return mapProblemset(result);
}

export async function fetchSubmissions(handle: string): Promise<Submission[]> {
  const result = await call<SubmissionResult>("user.status", { handle });
  return mapSubmissions(result);
}
