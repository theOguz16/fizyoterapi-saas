import { describe, expect, it } from "vitest";
import {
  formatTrainerTodayDate,
  selectTrainerNextBooking,
  selectTrainerRecentCheckins,
  selectTrainerRiskPreview,
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
});
