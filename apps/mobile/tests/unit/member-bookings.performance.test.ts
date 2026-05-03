import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { filterMemberBookingsBySegment, getBookingCancelState } from "@/lib/member-bookings";

describe("member bookings helpers load behavior", () => {
  it("partitions 500 bookings without dropping records", () => {
    const now = new Date("2026-03-05T09:00:00.000Z").getTime();
    const rows = Array.from({ length: 500 }, (_, index) => {
      const isUpcoming = index % 2 === 0;
      return {
        id: `booking-${index + 1}`,
        status: index % 11 === 0 ? "CANCELED" : "APPROVED",
        starts_at: isUpcoming
          ? `2026-03-${String((index % 20) + 6).padStart(2, "0")}T12:00:00.000Z`
          : `2026-03-${String((index % 4) + 1).padStart(2, "0")}T08:00:00.000Z`,
      };
    });

    const startedAt = performance.now();
    const upcoming = filterMemberBookingsBySegment(rows, "upcoming", now);
    const history = filterMemberBookingsBySegment(rows, "history", now);
    const cancelStates = rows.map((row) => getBookingCancelState(row, now));
    const elapsedMs = performance.now() - startedAt;

    expect(upcoming.every((row) => row.status !== "CANCELED")).toBe(true);
    expect(history.length + upcoming.length).toBe(500);
    expect(cancelStates.filter((state) => state === "İptal edilebilir").length).toBeGreaterThan(0);
    expect(cancelStates.filter((state) => state === "İptal kapalı").length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(80);
  });
});
