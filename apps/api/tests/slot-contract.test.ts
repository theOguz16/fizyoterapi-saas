import { describe, expect, it } from "vitest";
import { SlotValidationContractService } from "../services/slot-validation-contract.service";

describe("SlotValidationContractService", () => {
  it("normalizes working days legacy Sunday(0) into ISO Sunday(7)", () => {
    const days = SlotValidationContractService.normalizeWorkingDays([1, 2, 0, 7, 2]);
    expect(days).toEqual([1, 2, 7]);
  });

  it("validates a 30-min aligned slot within business hours", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 30,
    });

    const startsAt = new Date("2026-03-04T08:30:00.000Z"); // 11:30 TR
    const endsAt = new Date("2026-03-04T09:00:00.000Z"); // 12:00 TR
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);

    expect(result.ok).toBe(true);
  });

  it("rejects slot intersecting lunch break", () => {
    const contract = SlotValidationContractService.normalizeBusinessHours({
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 30,
    });

    const startsAt = new Date("2026-03-04T09:45:00.000Z"); // 12:45 TR
    const endsAt = new Date("2026-03-04T10:15:00.000Z"); // 13:15 TR
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, contract);

    expect(result.ok).toBe(false);
  });
});
