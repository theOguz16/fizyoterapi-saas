import { describe, expect, it } from "vitest";
import type { CalendarFeedEvent } from "@fitnes-saas/contracts";
import { calendarFeedEventToDetailRow, createCalendarFeedRange } from "@/lib/calendar-feed";

describe("mobile calendar feed", () => {
  it("requests a fixed range without projecting recurrence on the device", () => {
    const range = createCalendarFeedRange(new Date("2026-07-16T12:30:00.000Z"));
    expect(range).toEqual({
      from: "2026-07-16T00:00:00.000Z",
      to: "2027-01-14T00:00:00.000Z",
    });
  });

  it("maps the server event without changing its identity, status or time", () => {
    const event: CalendarFeedEvent = {
      id: "booking:booking-1",
      source: "BOOKING",
      entity_id: "booking-1",
      starts_at: "2026-07-20T09:00:00.000Z",
      ends_at: "2026-07-20T10:00:00.000Z",
      timezone: "Europe/Istanbul",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_cancelled: false,
      recurrence: { kind: "NONE", template_id: null, occurrence_starts_at: null },
      conflict: { has_conflict: false, event_ids: [] },
      presentation: { title: "Ders", subtitle: "Uzman • Paket", badge_label: "Onaylandı", badge_tone: "success" },
      details: { booking_id: "booking-1", trainer_id: "trainer-1", package_title: "Paket" },
    };

    expect(calendarFeedEventToDetailRow(event)).toMatchObject({
      id: "booking-1",
      calendar_event_id: "booking:booking-1",
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      status: "APPROVED",
      approval_status: "APPROVED",
    });
  });
});
