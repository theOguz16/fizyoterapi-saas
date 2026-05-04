import { describe, expect, it } from "vitest";
import {
  buildSlotStartMinutes,
  normalizeBusinessHours,
  resolveBusinessHours,
} from "../../src/lib/scheduling/business-hours.normalize";

describe("business hours helpers", () => {
  it("normalizes invalid inputs to safe empty business hours", () => {
    expect(
      normalizeBusinessHours({
        timezone: "",
        start_time: "99:61",
        end_time: "aa:bb",
        lunch_break_start: "24:00",
        lunch_break_end: "12:99",
        slot_minutes: 17,
        break_duration_minutes: 99,
        working_days: [0, 1, 1, 8, 5],
      })
    ).toEqual({
      timezone: null,
      start_time: null,
      end_time: null,
      lunch_break_start: null,
      lunch_break_end: null,
      has_lunch_break: false,
      slot_minutes: 60,
      break_duration_minutes: 0,
      working_days: [1, 5],
      is_configured: false,
    });
  });

  it("prefers the first configured object source when resolving business hours", () => {
    expect(
      resolveBusinessHours(
        [
          null,
          undefined,
          {
            timezone: "Europe/Berlin",
            start_time: "8:05",
            end_time: "18:15",
            lunch_break_start: "12:00",
            lunch_break_end: "13:00",
            slot_minutes: 45,
            break_duration_minutes: 10,
            working_days: [6, 2, 2, 4],
          },
          {
            timezone: "Europe/Istanbul",
            start_time: "09:00",
          },
        ],
        {
          locationTimezone: "Europe/Paris",
        }
      )
    ).toEqual({
      timezone: "Europe/Berlin",
      start_time: "08:05",
      end_time: "18:15",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      has_lunch_break: true,
      slot_minutes: 45,
      break_duration_minutes: 10,
      working_days: [2, 4, 6],
      is_configured: true,
    });
  });

  it("uses location timezone when business hours timezone is missing", () => {
    expect(
      resolveBusinessHours(
        [
          {
            start_time: "09:00",
            end_time: "18:00",
            working_days: [1, 2, 3, 4, 5],
          },
        ],
        {
          locationTimezone: "Europe/Berlin",
        }
      ).timezone
    ).toBe("Europe/Berlin");
  });

  it("does not enable lunch break when lunch fields are null", () => {
    const result = normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: null,
      lunch_break_end: null,
      slot_minutes: 60,
      break_duration_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
    });

    expect(result.has_lunch_break).toBe(false);
    expect(result.lunch_break_start).toBeNull();
    expect(result.lunch_break_end).toBeNull();
    expect(result.is_configured).toBe(true);
  });

  it("does not enable lunch break when lunch fields are empty strings", () => {
    const result = normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "",
      lunch_break_end: "",
      slot_minutes: 60,
      break_duration_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
    });

    expect(result.has_lunch_break).toBe(false);
    expect(result.lunch_break_start).toBeNull();
    expect(result.lunch_break_end).toBeNull();
    expect(result.is_configured).toBe(true);
  });

  it("does not enable lunch break when lunch range is invalid", () => {
    const result = normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "13:00",
      lunch_break_end: "12:00",
      slot_minutes: 60,
      break_duration_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
    });

    expect(result.has_lunch_break).toBe(false);
    expect(result.lunch_break_start).toBeNull();
    expect(result.lunch_break_end).toBeNull();
  });

  it("enables lunch break only when both lunch fields are valid and ordered", () => {
    const result = normalizeBusinessHours({
      start_time: "09:00",
      end_time: "18:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 60,
      break_duration_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
    });

    expect(result.has_lunch_break).toBe(true);
    expect(result.lunch_break_start).toBe("12:00");
    expect(result.lunch_break_end).toBe("13:00");
  });

  it("keeps generating slots until the last lesson still fits before closing time", () => {
    expect(buildSlotStartMinutes(9 * 60, 21 * 60, 60, 20)).toEqual([
      540, 620, 700, 780, 860, 940, 1020, 1100, 1180,
    ]);
  });

  it("allows the final slot to end exactly at closing time", () => {
    expect(buildSlotStartMinutes(9 * 60, 21 * 60, 60, 0)).toEqual([
      540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200,
    ]);
  });
});