import { describe, expect, it } from "vitest";
import { AppError } from "../errors/AppError";
import {
  ensureMinimumAdvanceHours,
  normalizeWorkingDaysToIso,
  parseBookingDate,
  parseClockTimeToMinutes,
  resolveMinimumAdvanceHours,
  validateBookingDuration,
} from "../controllers/trainer/booking-helpers";

describe("trainer booking helpers", () => {
  it("parses valid dates and rejects invalid ones", () => {
    expect(parseBookingDate("2026-03-05T09:00:00.000Z", "starts_at").toISOString()).toBe("2026-03-05T09:00:00.000Z");
    expect(() => parseBookingDate("not-a-date", "starts_at")).toThrowError(AppError);
  });

  it("parses clock time strings to minutes", () => {
    expect(parseClockTimeToMinutes("09:30", 0)).toBe(570);
    expect(parseClockTimeToMinutes("99:99", 10)).toBe(10);
    expect(parseClockTimeToMinutes(undefined, 15)).toBe(15);
  });

  it("normalizes weekdays into ISO values", () => {
    expect(normalizeWorkingDaysToIso([0, 1, 2, 7, 9, "x"])).toEqual([1, 2, 7]);
    expect(normalizeWorkingDaysToIso(undefined)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("enforces booking duration bounds", () => {
    expect(() =>
      validateBookingDuration(new Date("2026-03-05T09:00:00.000Z"), new Date("2026-03-05T09:10:00.000Z"))
    ).toThrowError(AppError);
    expect(() =>
      validateBookingDuration(new Date("2026-03-05T09:00:00.000Z"), new Date("2026-03-05T14:10:00.000Z"))
    ).toThrowError(AppError);
    expect(() =>
      validateBookingDuration(new Date("2026-03-05T09:00:00.000Z"), new Date("2026-03-05T10:00:00.000Z"))
    ).not.toThrow();
  });

  it("normalizes minimum advance hours", () => {
    expect(resolveMinimumAdvanceHours(6)).toBe(6);
    expect(resolveMinimumAdvanceHours(undefined)).toBe(3);
    expect(resolveMinimumAdvanceHours(0)).toBe(3);
  });

  it("enforces minimum advance window", () => {
    const now = new Date("2026-03-05T08:00:00.000Z");

    expect(() =>
      ensureMinimumAdvanceHours(
        new Date("2026-03-05T10:00:00.000Z"),
        3,
        "Ders",
        "TRAINER_BOOKING_NOTICE_WINDOW_CLOSED",
        now
      )
    ).toThrowError(AppError);

    expect(() =>
      ensureMinimumAdvanceHours(
        new Date("2026-03-05T11:30:00.000Z"),
        3,
        "Ders",
        "TRAINER_BOOKING_NOTICE_WINDOW_CLOSED",
        now
      )
    ).not.toThrow();
  });
});
