import { describe, expect, it } from "vitest";
import type { CalendarFeedEvent } from "@fitnes-saas/contracts";
import {
  calendarDateKey,
  calendarFeedEventToDetailRow,
  canShowTrainerCalendarCheckin,
  createCalendarFeedRange,
  isCalendarEventToday,
  splitMemberCalendarEvents,
} from "@/lib/calendar-feed";

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

  it("separates real lessons from availability preferences on the member calendar", () => {
    const base = {
      entity_id: "entity-1",
      starts_at: "2026-07-20T09:00:00.000Z",
      ends_at: "2026-07-20T10:00:00.000Z",
      timezone: "Europe/Istanbul",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_cancelled: false,
      recurrence: { kind: "NONE", template_id: null, occurrence_starts_at: null },
      conflict: { has_conflict: false, event_ids: [] },
      presentation: { title: "Kayıt", subtitle: "", badge_label: "Onaylandı", badge_tone: "success" },
      details: {},
    } as const;
    const events = [
      { ...base, id: "booking:1", source: "BOOKING" },
      { ...base, id: "availability:1", source: "AVAILABILITY" },
      { ...base, id: "pending-availability:1", source: "PENDING_AVAILABILITY", status: "PENDING", approval_status: "PENDING" },
    ] as CalendarFeedEvent[];

    const split = splitMemberCalendarEvents(events);
    expect(split.lessons.map((event) => event.id)).toEqual(["booking:1"]);
    expect(split.approvedPreferences.map((event) => event.id)).toEqual(["availability:1"]);
    expect(split.pendingPreferences.map((event) => event.id)).toEqual(["pending-availability:1"]);
  });

  it("uses the clinic timezone for day grouping and today's check-in action", () => {
    const instant = "2026-07-15T22:30:00.000Z";
    expect(calendarDateKey(instant, "Europe/Istanbul")).toBe("2026-07-16");
    expect(calendarDateKey(instant, "America/New_York")).toBe("2026-07-15");
    expect(
      isCalendarEventToday(instant, "Europe/Istanbul", new Date("2026-07-16T08:00:00.000Z"))
    ).toBe(true);
    expect(
      isCalendarEventToday(instant, "America/New_York", new Date("2026-07-16T08:00:00.000Z"))
    ).toBe(false);
  });

  it("shows quick check-in only for today's unfinished trainer sessions", () => {
    const now = new Date("2026-07-16T08:00:00.000Z");
    const event = {
      starts_at: "2026-07-16T09:00:00.000Z",
      source: "BOOKING",
      is_cancelled: false,
      checkin_status: "PENDING",
    };
    expect(canShowTrainerCalendarCheckin(event, "Europe/Istanbul", now)).toBe(true);
    expect(canShowTrainerCalendarCheckin({ ...event, checkin_status: "COMPLETED" }, "Europe/Istanbul", now)).toBe(false);
    expect(canShowTrainerCalendarCheckin({ ...event, source: "AVAILABILITY" }, "Europe/Istanbul", now)).toBe(false);
    expect(canShowTrainerCalendarCheckin({ ...event, is_cancelled: true }, "Europe/Istanbul", now)).toBe(false);
  });
});
