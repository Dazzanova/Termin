import { beforeEach, describe, expect, it } from "vitest";
import { client, ready } from "../db/database";
import type { Contest } from "../contests/types";
import { saveContests, saveParticipationStatus } from "../contests/repository";
import {
  applyReviewAction,
  getReview,
  getReviewCounts,
  getSolvedProblemIds,
  replaceSubmissions,
  saveProblems,
  saveReview,
} from "./repository";
import { rebuildUpsolveQueue } from "./upsolve";
import type { Problem, Submission } from "./types";

function makeContest(id: string, hoursAgo: number): Contest {
  return {
    id,
    platform: "codeforces",
    name: `Contest ${id}`,
    startTime: new Date(Date.now() - hoursAgo * 3_600_000),
    durationSeconds: 7200,
    url: `https://codeforces.com/contest/${id}`,
  };
}

function makeProblem(contestId: string, index: string): Problem {
  return {
    id: `codeforces:${contestId}${index}`,
    platform: "codeforces",
    contestId,
    index,
    name: `Problem ${index}`,
    rating: 1200,
    tags: ["dp"],
    url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
  };
}

function accepted(problem: Problem, id = "1"): Submission {
  return {
    id: `codeforces:${id}`,
    platform: "codeforces",
    problemId: problem.id,
    verdict: "OK",
    submittedAt: new Date(),
  };
}

beforeEach(async () => {
  await ready();
  await client.execute("DELETE FROM problem_reviews");
  await client.execute("DELETE FROM submissions");
  await client.execute("DELETE FROM problems");
  await client.execute("DELETE FROM participation");
  await client.execute("DELETE FROM contests");
});

describe("rebuildUpsolveQueue", () => {
  it("queues unsolved problems from attended contests only", async () => {
    const attended = makeContest("1001", 5);
    const missed = makeContest("1002", 5);

    await saveContests([attended, missed]);
    await saveParticipationStatus(attended.id, "participated");
    await saveParticipationStatus(missed.id, "planned");

    const solved = makeProblem("1001", "A");
    const unsolved = makeProblem("1001", "B");
    const fromMissed = makeProblem("1002", "A");

    await saveProblems([solved, unsolved, fromMissed]);
    await replaceSubmissions([accepted(solved)]);

    const result = await rebuildUpsolveQueue();

    expect(result).toEqual({ queued: 1, closed: 0 });
    expect((await getReview(unsolved.id))?.status).toBe("due");
    expect(await getReview(fromMissed.id)).toBeNull();
    expect(await getReview(solved.id)).toBeNull();
  });

  it("is idempotent across repeated imports", async () => {
    const contest = makeContest("1001", 5);
    await saveContests([contest]);
    await saveParticipationStatus(contest.id, "participated");

    const problem = makeProblem("1001", "A");
    await saveProblems([problem]);

    expect(await rebuildUpsolveQueue()).toEqual({ queued: 1, closed: 0 });
    expect(await rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 0 });
  });

  it("closes a review when the problem is solved later", async () => {
    const contest = makeContest("1001", 5);
    await saveContests([contest]);
    await saveParticipationStatus(contest.id, "participated");

    const problem = makeProblem("1001", "A");
    await saveProblems([problem]);
    await rebuildUpsolveQueue();

    await replaceSubmissions([accepted(problem)]);

    expect(await rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 1 });
    expect((await getReview(problem.id))?.status).toBe("done");
    expect(await getSolvedProblemIds()).toEqual(new Set([problem.id]));
  });

  it("skips contests whose problems were never imported", async () => {
    const contest = makeContest("9999", 5);
    await saveContests([contest]);
    await saveParticipationStatus(contest.id, "participated");

    expect(await rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 0 });
  });
});

describe("review actions", () => {
  const problem = makeProblem("1001", "A");
  const now = new Date("2026-10-25T12:00:00.000Z");

  beforeEach(async () => {
    await saveProblems([problem]);
  });

  it("advances the interval on each 'again'", async () => {
    await saveReview({
      problemId: problem.id,
      status: "due",
      dueAt: now,
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });

    const first = await applyReviewAction(problem.id, "again", now);
    expect(first?.status).toBe("scheduled");
    expect(first?.intervalDays).toBe(1);
    expect(first?.dueAt.getTime()).toBe(now.getTime() + 86_400_000);

    const second = await applyReviewAction(problem.id, "again", now);
    expect(second?.intervalDays).toBe(3);
    expect(second?.attempts).toBe(2);

    const third = await applyReviewAction(problem.id, "again", now);
    expect(third?.intervalDays).toBe(7);

    const fourth = await applyReviewAction(problem.id, "again", now);
    expect(fourth?.intervalDays).toBe(21);

    const fifth = await applyReviewAction(problem.id, "again", now);
    expect(fifth?.intervalDays).toBe(21);
  });

  it("closes the review on solved and drop", async () => {
    await saveReview({
      problemId: problem.id,
      status: "due",
      dueAt: now,
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });

    expect((await applyReviewAction(problem.id, "solved", now))?.status).toBe(
      "done"
    );
    expect((await applyReviewAction(problem.id, "drop", now))?.status).toBe(
      "dropped"
    );
  });

  it("returns null for an unknown problem", async () => {
    expect(await applyReviewAction("codeforces:404A", "solved", now)).toBeNull();
  });
});

describe("review counts", () => {
  it("splits due, upcoming, and done", async () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    const problems = ["A", "B", "C"].map((index) =>
      makeProblem("1001", index)
    );
    await saveProblems(problems);

    await saveReview({
      problemId: problems[0].id,
      status: "due",
      dueAt: new Date(now.getTime() - 3_600_000),
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });
    await saveReview({
      problemId: problems[1].id,
      status: "scheduled",
      dueAt: new Date(now.getTime() + 2 * 86_400_000),
      intervalDays: 3,
      attempts: 1,
      updatedAt: now,
    });
    await saveReview({
      problemId: problems[2].id,
      status: "done",
      dueAt: now,
      intervalDays: 1,
      attempts: 1,
      updatedAt: now,
    });

    expect(await getReviewCounts(now)).toEqual({ due: 1, upcoming: 1, done: 1 });
  });
});
