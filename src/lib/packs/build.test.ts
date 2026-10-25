import { describe, expect, it } from "vitest";
import {
  buildGenericPack,
  buildPack,
  listPacks,
  PACK_FILE_SETS,
} from "./build";
import type { Contest } from "../contests/types";
import type { Problem } from "../training/types";

const START = new Date("2026-10-25T14:35:00.000Z");

function contest(
  id: string,
  platform: Contest["platform"],
  overrides: Partial<Contest> = {}
): Contest {
  return {
    id,
    platform,
    name: `${platform} contest`,
    startTime: START,
    durationSeconds: 8_100,
    url: `https://example.com/${id.replace(":", "/")}`,
    ...overrides,
  };
}

function problem(index: string, name: string): Problem {
  return {
    id: `codeforces:1987${index}`,
    platform: "codeforces",
    contestId: "1987",
    index,
    name,
    rating: 1200,
    tags: ["implementation"],
    url: `https://codeforces.com/problemset/problem/1987/${index}`,
  };
}

describe("buildPack", () => {
  it("uses the real Codeforces letters and names from the catalog", () => {
    const pack = buildPack(contest("codeforces:1987", "codeforces"), [
      problem("B", "Card Game"),
      problem("A", "Array Cloning"),
      problem("C", "Three Sum"),
    ]);

    expect(pack.files.map((file) => file.name)).toEqual([
      "a.cpp",
      "b.cpp",
      "c.cpp",
    ]);
    expect(pack.files[0].contents).toContain("Array Cloning");
    expect(pack.files[0].contents).toContain(
      "https://codeforces.com/problemset/problem/1987/A"
    );
    expect(pack.files[0].contents).toContain("#include <bits/stdc++.h>");
  });

  it("falls back to the usual letters when the contest is not in the catalog", () => {
    const pack = buildPack(contest("codeforces:2099", "codeforces"), [
      problem("A", "Array Cloning"),
    ]);

    expect(pack.files).toHaveLength(PACK_FILE_SETS.codeforces.length);
    expect(pack.files[0].contents).toContain("Problem A");
    expect(pack.files[0].contents).toContain(
      "https://example.com/codeforces/2099"
    );
  });

  it("sizes AtCoder, CodeChef, and LeetCode packs by their own conventions", () => {
    const atcoder = buildPack(contest("atcoder:abc392", "atcoder"), []);
    const codechef = buildPack(contest("codechef:start263", "codechef"), []);
    const leetcode = buildPack(
      contest("leetcode:weekly-527", "leetcode"),
      []
    );

    expect(atcoder.files.map((file) => file.name)).toEqual([
      "a.cpp",
      "b.cpp",
      "c.cpp",
      "d.cpp",
      "e.cpp",
      "f.cpp",
      "g.cpp",
    ]);
    expect(leetcode.files.map((file) => file.name)).toEqual([
      "p1.cpp",
      "p2.cpp",
      "p3.cpp",
      "p4.cpp",
    ]);
    expect(codechef.files).toHaveLength(6);
  });

  it("builds a deterministic, filesystem-safe folder and id", () => {
    const pack = buildPack(contest("codeforces:1987", "codeforces"), []);

    expect(pack.id).toBe("contest-codeforces-1987");
    expect(pack.folder).toBe("termin-cf-1987");
    expect(pack.folder).toMatch(/^[a-z0-9-]+$/);
    expect(pack.id).not.toContain(":");
  });

  it("keeps an unknown or empty suffix out of the folder name", () => {
    const pack = buildPack(contest("codeforces:", "codeforces"), []);

    expect(pack.folder).toBe("termin-cf-contest");
    expect(buildPack(contest(":", "codeforces"), []).folder).toBe(
      "termin-cf-contest"
    );
  });

  it("describes the pack", () => {
    const pack = buildPack(
      contest("codeforces:1987", "codeforces", {
        name: "Codeforces Round 1001 (Div. 2)",
      }),
      []
    );

    expect(pack.title).toBe("Codeforces Round 1001 (Div. 2)");
    expect(pack.subtitle).toContain("2h 15m");
    expect(pack.subtitle).toContain("5 files");
    expect(pack.files.length).toBeGreaterThan(0);
  });
});

describe("buildGenericPack", () => {
  it("names the platform and points at the contest list", () => {
    const pack = buildGenericPack("leetcode");

    expect(pack.id).toBe("platform-leetcode");
    expect(pack.folder).toBe("termin-lc-template");
    expect(pack.title).toBe("Any LeetCode contest");
    expect(pack.files).toHaveLength(4);
    expect(pack.files[0].contents).toContain("LeetCode");
  });
});

describe("listPacks", () => {
  const contests = [
    contest("codeforces:1987", "codeforces", {
      startTime: new Date("2026-10-26T14:35:00.000Z"),
    }),
    contest("atcoder:abc392", "atcoder", {
      startTime: new Date("2026-10-25T12:00:00.000Z"),
    }),
    contest("leetcode:weekly-527", "leetcode", {
      startTime: new Date("2026-10-25T02:30:00.000Z"),
    }),
  ];

  it("orders upcoming contests by start time, then generic packs", () => {
    const packs = listPacks(contests, []);

    expect(packs.map((pack) => pack.id)).toEqual([
      "contest-leetcode-weekly-527",
      "contest-atcoder-abc392",
      "contest-codeforces-1987",
      "platform-codeforces",
      "platform-atcoder",
      "platform-codechef",
      "platform-leetcode",
    ]);
  });

  it("uses unique ids and folders", () => {
    const packs = listPacks(contests, []);

    expect(new Set(packs.map((pack) => pack.id)).size).toBe(packs.length);
    expect(new Set(packs.map((pack) => pack.folder)).size).toBe(packs.length);
    expect(packs.every((pack) => pack.files.length > 0)).toBe(true);
  });
});
