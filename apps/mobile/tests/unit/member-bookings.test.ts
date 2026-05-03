import { describe, expect, it } from "vitest";
import { filterMemberBookingsBySegment, getBookingCancelState } from "@/lib/member-bookings";

describe("member bookings helpers", () => {
  const now = new Date("2026-03-05T09:00:00.000Z").getTime();

  it("derives booking cancellation state from status and start time", () => {
    expect(getBookingCancelState({ status: "APPROVED", starts_at: "2026-03-05T13:30:00.000Z" }, now)).toBe(
      "İptal edilebilir"
    );
    expect(getBookingCancelState({ status: "APPROVED", starts_at: "2026-03-05T10:00:00.000Z" }, now)).toBe(
      "İptal süresi doldu"
    );
    expect(getBookingCancelState({ status: "CANCELED", starts_at: "2026-03-05T13:30:00.000Z" }, now)).toBe(
      "İptal kapalı"
    );
  });

  it("filters member bookings into upcoming and history segments", () => {
    const rows = [
      { id: "b1", status: "APPROVED", starts_at: "2026-03-05T13:30:00.000Z" },
      { id: "b2", status: "CANCELED", starts_at: "2026-03-06T09:00:00.000Z" },
      { id: "b3", status: "APPROVED", starts_at: "2026-03-04T09:00:00.000Z" },
    ];

    expect(filterMemberBookingsBySegment(rows, "upcoming", now).map((row) => row.id)).toEqual(["b1"]);
    expect(filterMemberBookingsBySegment(rows, "history", now).map((row) => row.id)).toEqual(["b2", "b3"]);
  });

  it("treats invalid dates as history and keeps them non-cancelable", () => {
    const rows = [
      { id: "broken", status: "APPROVED", starts_at: "not-a-date" },
      { id: "future-canceled", status: "CANCELED", starts_at: "2026-03-06T12:00:00.000Z" },
    ];

    expect(filterMemberBookingsBySegment(rows, "upcoming", now)).toEqual([]);
    expect(filterMemberBookingsBySegment(rows, "history", now).map((row) => row.id)).toEqual(["broken", "future-canceled"]);
    expect(getBookingCancelState(rows[0], now)).toBe("İptal kapalı");
  });
});
