import { describe, expect, it } from "vitest";
import {
  buildBusinessHours,
  buildMemberAvailabilityDateOptions,
  buildMemberAvailabilityIndex,
  buildMemberAvailabilitySlotOptions,
  buildRangeQuery,
  buildWeeklyBookingCountIndex,
  canMemberTakeAnotherLesson,
  ceilToSlot,
  floorToSlot,
  getAvailabilityHint,
  isWithinBusinessHoursRange,
  isWithinMemberAvailability,
  normalizeWorkingDays,
  reasonCodeLabel,
  slotDurationText,
  toLocalDateKey,
} from "@/app/trainer/bookings/booking-utils";

describe("booking utils", () => {
  it("snaps dates to slot boundaries", () => {
    const date = new Date("2026-03-05T10:17:20.000Z");
    expect(floorToSlot(date, 30).toISOString()).toBe("2026-03-05T10:00:00.000Z");
    expect(ceilToSlot(date, 30).toISOString()).toBe("2026-03-05T10:30:00.000Z");
    expect(toLocalDateKey(new Date("2026-03-05T10:17:20.000Z"))).toBe("2026-03-05");
  });

  it("builds range query and readable diagnostics", () => {
    expect(buildRangeQuery("a", "b")).toBe("?from=a&to=b");
    expect(buildRangeQuery(undefined, undefined)).toBe("");
    expect(reasonCodeLabel("NO_TRAINER_ASSIGNMENT")).toContain("atanmış değil");
  });

  it("normalizes working days and slot durations", () => {
    expect(normalizeWorkingDays({ working_days: [1, 2, 7] })).toEqual([0, 1, 2]);
    expect(slotDurationText(90)).toBe("01:30:00");
  });

  it("checks business hour boundaries and lunch overlap", () => {
    const ok = isWithinBusinessHoursRange(
      new Date("2026-03-05T09:00:00"),
      new Date("2026-03-05T10:00:00"),
      {
        effectiveWorkingDays: [4],
        startMinutes: 9 * 60,
        endMinutes: 18 * 60,
        lunchStartMinutes: 12 * 60,
        lunchEndMinutes: 13 * 60,
      }
    );
    const blocked = isWithinBusinessHoursRange(
      new Date("2026-03-05T12:15:00"),
      new Date("2026-03-05T12:45:00"),
      {
        effectiveWorkingDays: [4],
        startMinutes: 9 * 60,
        endMinutes: 18 * 60,
        lunchStartMinutes: 12 * 60,
        lunchEndMinutes: 13 * 60,
      }
    );

    expect(ok).toBe(true);
    expect(blocked).toBe(false);
  });

  it("builds business hour segments around lunch", () => {
    expect(buildBusinessHours("09:00", "18:00", "12:00", "13:00", [1, 2])).toEqual([
      { daysOfWeek: [1, 2], startTime: "09:00:00", endTime: "12:00:00" },
      { daysOfWeek: [1, 2], startTime: "13:00:00", endTime: "18:00:00" },
    ]);
  });

  it("indexes member availability and weekly booking limits", () => {
    const availabilities = [
      {
        id: "a1",
        member_id: "m1",
        member_weekly_class_hours: 2,
        starts_at: "2026-03-05T09:00:00.000Z",
        ends_at: "2026-03-05T11:00:00.000Z",
      },
      {
        id: "a2",
        member_id: "m1",
        member_weekly_class_hours: 2,
        starts_at: "2026-03-06T09:00:00.000Z",
        ends_at: "2026-03-06T10:00:00.000Z",
      },
    ] as any;
    const bookings = [
      { id: "b1", member_id: "m1", status: "PENDING" },
      { id: "b2", member_id: "m1", status: "CANCELED" },
    ] as any;
    const index = buildMemberAvailabilityIndex(availabilities);

    expect(isWithinMemberAvailability(index, "m1", new Date("2026-03-05T09:30:00.000Z"), new Date("2026-03-05T10:00:00.000Z"))).toBe(true);
    expect(buildWeeklyBookingCountIndex(bookings).get("m1")).toBe(1);
  });

  it("builds availability dates, slots and hints", () => {
    const availabilities = [
      {
        id: "a1",
        member_id: "m1",
        member_weekly_class_hours: 2,
        starts_at: "2026-03-05T09:10:00.000Z",
        ends_at: "2026-03-05T10:50:00.000Z",
        package_id: "pkg-1",
        package_title: "Paket",
        package_lesson_category: "GRUP",
        note: "uygun",
      },
    ] as any;

    const dates = buildMemberAvailabilityDateOptions(availabilities, "m1");
    const slots = buildMemberAvailabilitySlotOptions(
      availabilities,
      { member_id: "m1", package_id: "pkg-1", booking_date: "2026-03-05" },
      30,
      () => true
    );

    expect(dates).toHaveLength(1);
    expect(slots[0]).toEqual(
      expect.objectContaining({
        package_id: "pkg-1",
        lesson_category: "GRUP",
      })
    );
    expect(getAvailabilityHint(availabilities, "m1")).toMatch(/05[./]03/);
  });

  it("enforces weekly member lesson caps", () => {
    const weeklyCounts = new Map([["m1", 2]]);
    const weeklyLimits = new Map([["m1", 2]]);
    const bookings = [{ id: "b1", member_id: "m1" }] as any;

    expect(canMemberTakeAnotherLesson(weeklyCounts, weeklyLimits, bookings, "m1")).toBe(false);
    expect(canMemberTakeAnotherLesson(weeklyCounts, weeklyLimits, bookings, "m1", "b1")).toBe(true);
  });
});
