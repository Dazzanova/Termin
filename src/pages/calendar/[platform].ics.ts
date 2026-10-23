import type { APIRoute } from "astro";
import {
  buildCalendar,
  PLATFORM_LABELS,
} from "../../lib/calendar/ics";
import { calendarResponse } from "../../lib/calendar/http";
import { getUpcomingContests } from "../../lib/contests/getUpcomingContests";
import type { ContestPlatform } from "../../lib/contests/types";
import { SUPPORTED_PLATFORMS } from "../../lib/preferences/types";

export const prerender = true;

export function getStaticPaths() {
  return SUPPORTED_PLATFORMS.map((platform) => ({
    params: { platform },
  }));
}

export const GET: APIRoute = ({ params }) => {
  const platform = params.platform as ContestPlatform | undefined;

  if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
    return new Response("Unknown platform", { status: 404 });
  }

  const contests = getUpcomingContests([platform]);
  const label = PLATFORM_LABELS[platform];

  const body = buildCalendar(contests, {
    name: `Termin — ${label}`,
    description: `Upcoming ${label} contests aggregated by Termin.`,
  });

  return calendarResponse(body, `${platform}.ics`);
};
