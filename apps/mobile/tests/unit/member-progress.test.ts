import { describe, expect, it } from "vitest";
import {
  buildMeasurementTrend,
  buildMemberProgressMetrics,
  buildPackageUsageForecast,
  formatAttendanceResult,
  formatMeasurementValue,
  getLatestMeasurement,
} from "@/lib/member-progress";

describe("member progress helpers", () => {
  it("builds summary metrics with safe defaults", () => {
    expect(buildMemberProgressMetrics(null)).toEqual({
      totalAttendance: 0,
      groupAttendance: 0,
      remainingCredits: 0,
    });

    expect(
      buildMemberProgressMetrics({
        total_attendance_count: 12,
        group_attendance_count: 5,
        remaining_total_credits: 8,
      })
    ).toEqual({
      totalAttendance: 12,
      groupAttendance: 5,
      remainingCredits: 8,
    });
  });

  it("forecasts package usage after upcoming reservations", () => {
    const result = buildPackageUsageForecast({
      remainingCredits: 8,
      upcomingBookingCount: 3,
      weeklyUsage: 2,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(result.availableAfterReservations).toBe(5);
    expect(result.weeksRemaining).toBe(4);
    expect(result.estimatedEnd.toISOString().slice(0, 10)).toBe("2026-06-29");
  });

  it("compares the latest and oldest measurement", () => {
    expect(buildMeasurementTrend([{ weight_kg: 70 }, { weight_kg: 74 }], "weight_kg")).toEqual({
      latest: 70,
      previous: 74,
      delta: -4,
      direction: "DOWN",
    });
  });

  it("formats latest measurement and attendance labels", () => {
    expect(getLatestMeasurement([{ measured_at: "2026-03-05T09:00:00.000Z" }])).toEqual({
      measured_at: "2026-03-05T09:00:00.000Z",
    });
    expect(getLatestMeasurement([])).toBeNull();
    expect(formatMeasurementValue(68.5, " kg")).toBe("68.5 kg");
    expect(formatMeasurementValue(null, " kg")).toBe("-");
    expect(formatAttendanceResult("CREDIT_DEDUCTED")).toBe("Derse katıldı");
    expect(formatAttendanceResult(undefined)).toBe("Belirtilmedi");
  });

  it("keeps zero values visible and preserves unknown attendance statuses", () => {
    expect(formatMeasurementValue(0, " kg")).toBe("0 kg");
    expect(formatAttendanceResult("NO_CREDIT")).toBe("NO_CREDIT");
  });
});
