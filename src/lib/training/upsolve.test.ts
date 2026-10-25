import { beforeEach, describe, expect, it } from "vitest";
import db from "../db/database";
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

beforeEach(() => {
  db.exec("DELETE FROM problem_reviews");
  db.exec("DELETE FROM submissions");
  db.exec("DELETE FROM problems");
  db.exec("DELETE FROM participation");
  db.exec("DELETE FROM contests");
});

describe("rebuildUpsolveQueue", () => {
  it("queues unsolved problems from attended contests only", () => {
    const attended = makeContest("1001", 5);
    const missed = makeContest("1002", 5);

    saveContests([attended, missed]);
    saveParticipationStatus(attended.id, "participated");
    saveParticipationStatus(missed.id, "planned");

    const solved = makeProblem("1001", "A");
    const unsolved = makeProblem("1001", "B");
    const fromMissed = makeProblem("1002", "A");

    saveProblems([solved, unsolved, fromMissed]);
    replaceSubmissions([accepted(solved)]);

    const result = rebuildUpsolveQueue();

    expect(result).toEqual({ queued: 1, closed: 0 });
    expect(getReview(unsolved.id)?.status).toBe("due");
    expect(getReview(fromMissed.id)).toBeNull();
    expect(getReview(solved.id)).toBeNull();
  });

  it("is idempotent across repeated imports", () => {
    const contest = makeContest("1001", 5);
    saveContests([contest]);
    saveParticipationStatus(contest.id, "participated");

    const problem = makeProblem("1001", "A");
    saveProblems([problem]);

    expect(rebuildUpsolveQueue()).toEqual({ queued: 1, closed: 0 });
    expect(rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 0 });
  });

  it("closes a review when the problem is solved later", () => {
    const contest = makeContest("1001", 5);
    saveContests([contest]);
    saveParticipationStatus(contest.id, "participated");

    const problem = makeProblem("1001", "A");
    saveProblems([problem]);
    rebuildUpsolveQueue();

    replaceSubmissions([accepted(problem)]);

    expect(rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 1 });
    expect(getReview(problem.id)?.status).toBe("done");
    expect(getSolvedProblemIds()).toEqual(new Set([problem.id]));
  });

  it("skips contests whose problems were never imported", () => {
    const contest = makeContest("9999", 5);
    saveContests([contest]);
    saveParticipationStatus(contest.id, "participated");

    expect(rebuildUpsolveQueue()).toEqual({ queued: 0, closed: 0 });
  });
});

describe("review actions", () => {
  const problem = makeProblem("1001", "A");
  const now = new Date("2026-10-25T12:00:00.000Z");

  beforeEach(() => {
    saveProblems([problem]);
  });

  it("advances the interval on each 'again'", () => {
    saveReview({
      problemId: problem.id,
      status: "due",
      dueAt: now,
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });

    const first = applyReviewAction(problem.id, "again", now);
    expect(first?.status).toBe("scheduled");
    expect(first?.intervalDays).toBe(1);
    expect(first?.dueAt.getTime()).toBe(now.getTime() + 86_400_000);

    const second = applyReviewAction(problem.id, "again", now);
    expect(second?.intervalDays).toBe(3);
    expect(second?.attempts).toBe(2);

    const third = applyReviewAction(problem.id, "again", now);
    expect(third?.intervalDays).toBe(7);

    const fourth = applyReviewAction(problem.id, "again", now);
    expect(fourth?.intervalDays).toBe(21);

    const fifth = applyReviewAction(problem.id, "again", now);
    expect(fifth?.intervalDays).toBe(21);
  });

  it("closes the review on solved and drop", () => {
    saveReview({
      problemId: problem.id,
      status: "due",
      dueAt: now,
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });

    expect(applyReviewAction(problem.id, "solved", now)?.status).toBe("done");
    expect(applyReviewAction(problem.id, "drop", now)?.status).toBe("dropped");
  });

  it("returns null for an unknown problem", () => {
    expect(applyReviewAction("codeforces:404A", "solved", now)).toBeNull();
  });
});

describe("review counts", () => {
  it("splits due, upcoming, and done", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    const problems = ["A", "B", "C"].map((index) =>
      makeProblem("1001", index)
    );
    saveProblems(problems);

    saveReview({
      problemId: problems[0].id,
      status: "due",
      dueAt: new Date(now.getTime() - 3_600_000),
      intervalDays: 1,
      attempts: 0,
      updatedAt: now,
    });
    saveReview({
      problemId: problems[1].id,
      status: "scheduled",
      dueAt: new Date(now.getTime() + 2 * 86_400_000),
      intervalDays: 3,
      attempts: 1,
      updatedAt: now,
    });
    saveReview({
      problemId: problems[2].id,
      status: "done",
      dueAt: now,
      intervalDays: 1,
      attempts: 1,
      updatedAt: now,
    });

    expect(getReviewCounts(now)).toEqual({ due: 1, upcoming: 1, done: 1 });
  });
});
