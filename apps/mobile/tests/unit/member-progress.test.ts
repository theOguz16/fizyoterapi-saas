import { describe, expect, it } from "vitest";
import {
  buildMemberProgressMetrics,
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
