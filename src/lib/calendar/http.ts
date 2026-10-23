export function calendarResponse(
  body: string,
  filename = "termin.ics"
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=1800",
    },
  });
}
