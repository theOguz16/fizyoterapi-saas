import { describe, expect, it } from "vitest";
import {
  canTrainerBookingCheckIn,
  canTrainerBookingManageSchedule,
  formatTrainerTodayTime,
  formatTrainerTodayDate,
  resolveTrainerFocusedBookingEventId,
  selectTrainerNextBooking,
  selectTrainerRecentCheckins,
  selectTrainerRiskPreview,
  sortTrainerTodayBookings,
} from "@/lib/trainer-today";

describe("trainer today helpers", () => {
  it("formats trainer dates and handles missing values", () => {
    expect(formatTrainerTodayDate(null)).toBe("Belirtilmedi");
    expect(formatTrainerTodayDate("2026-03-05T09:00:00.000Z")).toContain("05.03.2026");
  });

  it("selects next booking safely", () => {
    expect(selectTrainerNextBooking(null)).toBeNull();
    expect(selectTrainerNextBooking([{ id: "b1" }, { id: "b2" }])).toEqual({ id: "b1" });
  });

  it("derives risk preview and recent checkins safely", () => {
    expect(selectTrainerRiskPreview({ risk: { preview: [{ id: "r1" }] } })).toEqual([{ id: "r1" }]);
    expect(selectTrainerRiskPreview(null)).toEqual([]);
    expect(selectTrainerRecentCheckins({ checkins: [{ id: 1 }, { id: 2 }, { id: 3 }] }, 2)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns null next booking and empty arrays for malformed payloads", () => {
    expect(selectTrainerNextBooking([])).toBeNull();
    expect(selectTrainerRiskPreview({ risk: { preview: null } })).toEqual([]);
    expect(selectTrainerRecentCheckins({ checkins: null }, 3)).toEqual([]);
  });

  it("orders the daily operation and closes invalid actions", () => {
    const bookings = sortTrainerTodayBookings([
      { id: "late", starts_at: "2026-07-16T14:00:00.000Z", session_id: "session-2", status: "CANCELED" },
      { id: "early", starts_at: "2026-07-16T08:00:00.000Z", session_id: "session-1", status: "APPROVED" },
      { id: "unknown", starts_at: null, status: "PENDING" },
    ]);

    expect(bookings.map((row) => row.id)).toEqual(["early", "late", "unknown"]);
    expect(canTrainerBookingCheckIn(bookings[0])).toBe(true);
    expect(canTrainerBookingCheckIn(bookings[1])).toBe(false);
    expect(canTrainerBookingCheckIn(bookings[2])).toBe(false);
    expect(canTrainerBookingManageSchedule(bookings[0])).toBe(true);
    expect(canTrainerBookingManageSchedule(bookings[1])).toBe(false);
    expect(formatTrainerTodayTime("broken")).toBe("Saat yok");
  });

  it("resolves a home session to its calendar detail event", () => {
    const rows = [
      { id: "booking-1", calendar_event_id: "booking:booking-1" },
      { entity_id: "booking-2", calendar_event_id: "booking:booking-2" },
    ];

    expect(resolveTrainerFocusedBookingEventId(rows, "booking-1")).toBe("booking:booking-1");
    expect(resolveTrainerFocusedBookingEventId(rows, "booking-2")).toBe("booking:booking-2");
    expect(resolveTrainerFocusedBookingEventId(rows, "missing")).toBeNull();
  });
});
