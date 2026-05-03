import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { normalizePackageOptions, normalizeTrainerOptions } from "@/lib/purchase-funnel";

describe("purchase funnel helper load behavior", () => {
  it("normalizes large package and trainer payloads for mobile intake flow", () => {
    const packages = Array.from({ length: 500 }, (_, index) => ({
      id: `pkg-${index + 1}`,
      title: index % 9 === 0 ? "" : `Paket ${index + 1}`,
      total_credits: (index % 12) + 4,
      weekly_class_hours: index % 5 === 0 ? null : (index % 7) + 1,
      is_available: index % 13 !== 0,
    }));
    const trainers = Array.from({ length: 250 }, (_, index) =>
      index % 17 === 0
        ? ({ full_name: `Eksik ${index + 1}` } as any)
        : ({
            id: `trainer-${index + 1}`,
            full_name: `Trainer ${index + 1}`,
            specialties: index % 2 === 0 ? ["PT"] : undefined,
            is_available: index % 8 !== 0,
          } as any)
    );

    const startedAt = performance.now();
    const normalizedPackages = normalizePackageOptions(packages);
    const normalizedTrainers = normalizeTrainerOptions(trainers, null);
    const elapsedMs = performance.now() - startedAt;

    expect(normalizedPackages).toHaveLength(500);
    expect(normalizedPackages[0]).toEqual(
      expect.objectContaining({
        id: "pkg-1",
        weekly_class_hours: expect.any(Number),
        required_preference_slots: expect.any(Number),
        required_trainer_free_slots: expect.any(Number),
      })
    );
    expect(normalizedTrainers.length).toBeLessThan(250);
    expect(normalizedTrainers.every((row) => typeof row.id === "string" && row.id.length > 0)).toBe(true);
    expect(normalizedTrainers[0]).toEqual(
      expect.objectContaining({
        full_name: expect.any(String),
        is_available: expect.any(Boolean),
      })
    );
    expect(elapsedMs).toBeLessThan(120);
  });
});
