import type { APIRoute } from "astro";
import { buildCalendar } from "../lib/calendar/ics";
import { calendarResponse } from "../lib/calendar/http";
import { getUpcomingContests } from "../lib/contests/getUpcomingContests";

export const prerender = true;

export const GET: APIRoute = () => {
  const contests = getUpcomingContests();

  const body = buildCalendar(contests, {
    name: "Termin — All contests",
    description:
      "Upcoming competitive programming contests aggregated by Termin.",
  });

  return calendarResponse(body);
};
