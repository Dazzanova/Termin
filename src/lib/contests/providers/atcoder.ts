import * as cheerio from "cheerio";
import type { Contest } from "../types";

const ATCODER_URL = "https://atcoder.jp/contests?lang=en";

export async function getAtCoderContests(): Promise<Contest[]> {
  const response = await fetch(ATCODER_URL);

  if (!response.ok) {
    throw new Error(`AtCoder returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const contests: Contest[] = [];

  $("#contest-table-upcoming tbody tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length < 3) {
      return;
    }

    const timeLink = $(cells[0]).find("a").first();
    const contestLink = $(cells[1]).find("a").first();

    const time = timeLink.attr("href");
    const url = contestLink.attr("href");
    const name = contestLink.text().trim();
    const duration = $(cells[2]).text().trim();

    if (!time || !url || !name || !duration) {
      return;
    }

    const match = time.match(/iso=(\d{8}T\d{4})/);

    if (!match) {
      return;
    }

    const startTime = parseAtCoderTime(match[1]);
    const [hours, minutes] = duration.split(":").map(Number);

    contests.push({
      id: `atcoder:${url.split("/").pop()}`,
      platform: "atcoder",
      name,
      startTime,
      durationSeconds: hours * 3600 + minutes * 60,
      url: `https://atcoder.jp${url}`,
    });
  });

  return contests;
}

function parseAtCoderTime(value: string): Date {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(9, 11));
  const minute = Number(value.slice(11, 13));

  return new Date(
    Date.UTC(year, month, day, hour - 9, minute)
  );
}
