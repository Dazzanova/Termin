import { describe, expect, it } from "vitest";
import { validateContest, validateContests } from "./validate";
import type { Contest } from "./types";

const validContest = (): Contest => ({
  id: "codeforces:123",
  platform: "codeforces",
  name: "Codeforces Round 900",
  startTime: new Date("2026-10-01T12:00:00.000Z"),
  durationSeconds: 7200,
  url: "https://codeforces.com/contest/123",
});

describe("validateContest", () => {
  it("accepts a fully valid contest", () => {
    expect(validateContest(validContest())).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(validateContest({ ...validContest(), id: "" })).toBe(false);
  });

  it("rejects a whitespace-only id", () => {
    expect(validateContest({ ...validContest(), id: "   " })).toBe(false);
  });

  it("rejects an unsupported platform", () => {
    expect(
      validateContest({
        ...validContest(),
        // Cast to bypass TS — simulates a runtime provider returning garbage.
        platform: "hackerrank" as Contest["platform"],
      })
    ).toBe(false);
  });

  it("accepts all four known platforms", () => {
    const platforms: Contest["platform"][] = [
      "codeforces",
      "atcoder",
      "codechef",
      "leetcode",
    ];
    for (const platform of platforms) {
      expect(validateContest({ ...validContest(), platform })).toBe(true);
    }
  });

  it("rejects an empty name", () => {
    expect(validateContest({ ...validContest(), name: "" })).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    expect(validateContest({ ...validContest(), name: "   " })).toBe(false);
  });

  it("rejects an invalid Date (NaN)", () => {
    expect(
      validateContest({ ...validContest(), startTime: new Date("not-a-date") })
    ).toBe(false);
  });

  it("rejects zero duration", () => {
    expect(validateContest({ ...validContest(), durationSeconds: 0 })).toBe(
      false
    );
  });

  it("rejects negative duration", () => {
    expect(validateContest({ ...validContest(), durationSeconds: -3600 })).toBe(
      false
    );
  });

  it("rejects a non-HTTP/HTTPS url", () => {
    expect(
      validateContest({ ...validContest(), url: "ftp://example.com/contest" })
    ).toBe(false);
  });

  it("rejects a plain string as url", () => {
    expect(
      validateContest({ ...validContest(), url: "not-a-url" })
    ).toBe(false);
  });

  it("accepts an http:// url", () => {
    expect(
      validateContest({ ...validContest(), url: "http://codeforces.com/contest/123" })
    ).toBe(true);
  });
});

describe("validateContests", () => {
  it("filters out invalid contests and keeps valid ones", () => {
    const good = validContest();
    const bad: Contest = { ...validContest(), id: "" };

    const result = validateContests([good, bad]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(good);
  });

  it("returns an empty array when all contests are invalid", () => {
    expect(validateContests([{ ...validContest(), name: "" }])).toEqual([]);
  });
});
