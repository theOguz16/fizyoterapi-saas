import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_HOURS, buildSlotStartMinutes, normalizeBusinessHours, resolveBusinessHours } from "@/lib/business-hours";

describe("business hours helpers", () => {
  it("normalizes invalid inputs back to safe defaults", () => {
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
      timezone: DEFAULT_BUSINESS_HOURS.timezone,
      start_time: DEFAULT_BUSINESS_HOURS.start_time,
      end_time: DEFAULT_BUSINESS_HOURS.end_time,
      lunch_break_start: DEFAULT_BUSINESS_HOURS.lunch_break_start,
      lunch_break_end: DEFAULT_BUSINESS_HOURS.lunch_break_end,
      slot_minutes: DEFAULT_BUSINESS_HOURS.slot_minutes,
      break_duration_minutes: DEFAULT_BUSINESS_HOURS.break_duration_minutes,
      working_days: [1, 5],
    });
  });

  it("prefers the first object source when resolving business hours", () => {
    expect(
      resolveBusinessHours(
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
        }
      )
    ).toEqual({
      timezone: "Europe/Berlin",
      start_time: "08:05",
      end_time: "18:15",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 45,
      break_duration_minutes: 10,
      working_days: [2, 4, 6],
    });
  });

  it("keeps generating slots until the last lesson still fits before closing time", () => {
    expect(buildSlotStartMinutes(9 * 60, 21 * 60, 60, 20)).toEqual([540, 620, 700, 780, 860, 940, 1020, 1100, 1180]);
  });

  it("allows the final slot to end exactly at closing time", () => {
    expect(buildSlotStartMinutes(9 * 60, 21 * 60, 60, 0)).toEqual([540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200]);
  });
});
