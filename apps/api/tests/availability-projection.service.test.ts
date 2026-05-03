import { describe, expect, it } from "vitest";
import { AvailabilityProjectionService } from "../services/availability-projection.service";

describe("AvailabilityProjectionService", () => {
  const templateRows = [
    {
      id: "availability-1",
      member_id: "member-1",
      starts_at: new Date("2026-03-05T07:00:00.000Z"),
      ends_at: new Date("2026-03-05T08:00:00.000Z"),
      package_id: "package-1",
      note: "Persembe sabah",
    },
    {
      id: "availability-2",
      member_id: "member-1",
      starts_at: new Date("2026-03-05T08:00:00.000Z"),
      ends_at: new Date("2026-03-05T09:00:00.000Z"),
      package_id: "package-1",
      note: "Persembe ikinci slot",
    },
  ];

  it("projects weekly template rows into a future range", () => {
    const projected = AvailabilityProjectionService.projectWeeklyRange(
      templateRows,
      new Date("2026-03-12T00:00:00.000Z"),
      new Date("2026-03-13T00:00:00.000Z")
    );

    expect(projected).toHaveLength(2);
    expect(projected.map((row) => row.starts_at.toISOString())).toEqual([
      "2026-03-12T07:00:00.000Z",
      "2026-03-12T08:00:00.000Z",
    ]);
  });

  it("accepts a future booking that matches the same weekly pattern", () => {
    const matched = AvailabilityProjectionService.matchesWeeklyPattern(
      templateRows,
      new Date("2026-03-19T07:00:00.000Z"),
      new Date("2026-03-19T08:00:00.000Z")
    );

    expect(matched).toBe(true);
  });

  it("rejects a future booking outside the saved weekly pattern", () => {
    const matched = AvailabilityProjectionService.matchesWeeklyPattern(
      templateRows,
      new Date("2026-03-19T09:00:00.000Z"),
      new Date("2026-03-19T10:00:00.000Z")
    );

    expect(matched).toBe(false);
  });
});
