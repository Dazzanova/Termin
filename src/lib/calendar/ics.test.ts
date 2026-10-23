import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import type { Contest } from "../contests/types";
import {
  buildCalendar,
  escapeText,
  foldLine,
  formatUtc,
} from "./ics";

const NOW = new Date("2026-10-23T12:00:00Z");

function makeContest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: "codeforces:1000",
    platform: "codeforces",
    name: "Codeforces Round 1000",
    startTime: new Date("2026-11-01T15:05:00Z"),
    durationSeconds: 7200,
    url: "https://codeforces.com/contest/1000",
    ...overrides,
  };
}

function parseCalendar(text: string) {
  const component = new ICAL.Component(ICAL.parse(text));
  const events = component
    .getAllSubcomponents("vevent")
    .map((event) => new ICAL.Event(event));

  return { component, events };
}

describe("escapeText", () => {
  it("escapes separators, backslashes, and newlines", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("normalizes CRLF and lone CR", () => {
    expect(escapeText("a\r\nb\rc")).toBe("a\\nb\\nc");
  });
});

describe("formatUtc", () => {
  it("formats a UTC timestamp without milliseconds", () => {
    expect(formatUtc(new Date("2026-01-02T03:04:05.678Z"))).toBe(
      "20260102T030405Z"
    );
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    const line = "SUMMARY:Short";

    expect(foldLine(line)).toBe(line);
  });

  it("folds long ASCII lines at 75 octets", () => {
    const line = `SUMMARY:${"A".repeat(120)}`;
    const folded = foldLine(line);
    const physicalLines = folded.split("\r\n");

    expect(physicalLines.length).toBeGreaterThan(1);

    for (const physical of physicalLines) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }

    expect(physicalLines.slice(1).every((line) => line.startsWith(" "))).toBe(
      true
    );
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(80)}`;
    const folded = foldLine(line);

    for (const physical of folded.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }

    expect(folded).not.toContain("\uFFFD");
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildCalendar", () => {
  it("uses CRLF and produces a parseable feed", () => {
    const text = buildCalendar([makeContest()], {
      name: "Termin — Test",
      now: NOW,
    });

    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);

    for (const line of text.split("\r\n")) {
      expect(line).not.toContain("\n");
    }

    const { component, events } = parseCalendar(text);

    expect(component.name).toBe("vcalendar");
    expect(events).toHaveLength(1);
  });

  it("maps contest fields to event properties", () => {
    const text = buildCalendar(
      [makeContest({ name: "Round 1000, Div. 2; Open" })],
      { name: "Termin — Test", now: NOW }
    );

    const { events } = parseCalendar(text);
    const event = events[0];

    expect(event.uid).toBe("codeforces:1000@termin");
    expect(event.summary).toBe("Round 1000, Div. 2; Open");
    expect(event.startDate.toJSDate().toISOString()).toBe(
      "2026-11-01T15:05:00.000Z"
    );
    expect(event.endDate.toJSDate().toISOString()).toBe(
      "2026-11-01T17:05:00.000Z"
    );
    expect(event.component.getFirstPropertyValue("url")).toBe(
      "https://codeforces.com/contest/1000"
    );
  });

  it("sorts events by start time", () => {
    const later = makeContest({
      id: "atcoder:2",
      platform: "atcoder",
      startTime: new Date("2026-11-03T10:00:00Z"),
    });
    const sooner = makeContest({
      id: "codechef:1",
      platform: "codechef",
      startTime: new Date("2026-11-02T10:00:00Z"),
    });

    const { events } = parseCalendar(
      buildCalendar([later, sooner], { name: "Termin", now: NOW })
    );

    expect(events.map((event) => event.uid)).toEqual([
      "codechef:1@termin",
      "atcoder:2@termin",
    ]);
  });

  it("keeps UIDs stable while DTSTAMP follows the build time", () => {
    const contest = makeContest();
    const first = parseCalendar(
      buildCalendar([contest], { name: "Termin", now: NOW })
    ).events[0];
    const second = parseCalendar(
      buildCalendar([contest], {
        name: "Termin",
        now: new Date("2026-10-24T12:00:00Z"),
      })
    ).events[0];

    expect(second.uid).toBe(first.uid);

    const stamp = second.component.getFirstPropertyValue(
      "dtstamp"
    ) as ICAL.Time;

    expect(stamp.toJSDate().toISOString()).toBe(
      "2026-10-24T12:00:00.000Z"
    );
  });

  it("emits a valid empty calendar", () => {
    const text = buildCalendar([], { name: "Termin — Empty", now: NOW });
    const { component, events } = parseCalendar(text);

    expect(component.name).toBe("vcalendar");
    expect(events).toHaveLength(0);
    expect(text).toContain("X-WR-CALNAME:Termin — Empty");
  });
});
