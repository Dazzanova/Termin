import type { Contest } from "../contests/types";
import { PLATFORM_NAMES } from "../contests/platforms";

export type CalendarOptions = {
  name: string;
  description?: string;
  refreshHours?: number;
  now?: Date;
};

const CRLF = "\r\n";
const DEFAULT_REFRESH_HOURS = 6;

/**
 * Escapes a value for an iCalendar TEXT property (RFC 5545 §3.3.11).
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Formats a date as a UTC iCalendar DATE-TIME value.
 */
export function formatUtc(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
      date.getUTCDate()
    )}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
      date.getUTCSeconds()
    )}Z`
  );
}

/**
 * Folds a content line at 75 octets, never splitting a UTF-8 character.
 * Continuation lines start with a single space, which counts toward the limit.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= 75) {
    return line;
  }

  const chunks: string[] = [];
  let offset = 0;
  let limit = 75;

  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);

    while (end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end -= 1;
    }

    chunks.push(decoder.decode(bytes.subarray(offset, end)));
    offset = end;
    limit = 74;
  }

  return chunks.join(`${CRLF} `);
}

function buildEvent(contest: Contest, now: Date): string[] {
  const start = contest.startTime;
  const end = new Date(start.getTime() + contest.durationSeconds * 1000);
  const platform = PLATFORM_NAMES[contest.platform];
  const description = `${platform} contest${CRLF}${contest.url}`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:${contest.id}@termin`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(start)}`,
  ];

  if (contest.durationSeconds > 0) {
    lines.push(`DTEND:${formatUtc(end)}`);
  } else {
    lines.push("DURATION:PT0S");
  }

  lines.push(
    `SUMMARY:${escapeText(contest.name)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${contest.url}`,
    `CATEGORIES:${escapeText(platform)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT"
  );

  return lines;
}

/**
 * Serializes contests into a valid iCalendar feed.
 */
export function buildCalendar(
  contests: Contest[],
  options: CalendarOptions
): string {
  const now = options.now ?? new Date();
  const refreshHours = options.refreshHours ?? DEFAULT_REFRESH_HOURS;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Termin//Contest Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
  ];

  if (options.description) {
    lines.push(`X-WR-CALDESC:${escapeText(options.description)}`);
  }

  lines.push(
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`,
    `X-PUBLISHED-TTL:PT${refreshHours}H`
  );

  const sorted = [...contests].sort((a, b) => {
    const byStart = a.startTime.getTime() - b.startTime.getTime();
    return byStart !== 0 ? byStart : a.id.localeCompare(b.id);
  });

  for (const contest of sorted) {
    lines.push(...buildEvent(contest, now));
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}
