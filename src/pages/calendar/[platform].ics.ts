import type { APIRoute } from "astro";
import { buildCalendar } from "../../lib/calendar/ics";
import { calendarResponse } from "../../lib/calendar/http";
import { getUpcomingContests } from "../../lib/contests/getUpcomingContests";
import { PLATFORM_NAMES } from "../../lib/contests/platforms";
import type { ContestPlatform } from "../../lib/contests/types";
import { SUPPORTED_PLATFORMS } from "../../lib/preferences/types";

export const GET: APIRoute = async ({ params }) => {
  const platform = params.platform as ContestPlatform | undefined;

  if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
    return new Response("Unknown platform", { status: 404 });
  }

  const contests = await getUpcomingContests([platform]);
  const label = PLATFORM_NAMES[platform];

  const body = buildCalendar(contests, {
    name: `Termin — ${label}`,
    description: `Upcoming ${label} contests aggregated by Termin.`,
  });

  return calendarResponse(body, `${platform}.ics`);
};
