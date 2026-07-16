import type { CalendarFeed } from "@fitnes-saas/contracts";
import type { CalendarFeedRange } from "../calendar-feed";
import { httpRequest } from "../http-client";

export async function getCalendarFeedApi(range: CalendarFeedRange) {
  const search = new URLSearchParams({ from: range.from, to: range.to });
  if (range.timezone) search.set("timezone", range.timezone);
  return httpRequest<CalendarFeed>(`/calendar/feed?${search.toString()}`);
}
