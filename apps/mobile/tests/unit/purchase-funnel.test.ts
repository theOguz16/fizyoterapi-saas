import { describe, expect, it, vi } from "vitest";
import type { SalonDiscoverySummary, TrainerOption } from "@/lib/mobile-api";
import {
  buildSalonDayOptions,
  fallbackPackageOptions,
  normalizePackageOptions,
  normalizeTrainerOptions,
} from "@/lib/purchase-funnel";

describe("purchase funnel helpers", () => {
  it("builds day options from salon business hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T10:00:00.000Z"));

    const result = buildSalonDayOptions({
      id: "salon-1",
      slug: "demo",
      name: "Demo",
      business_hours: {
        working_days: [1, 3, 5],
        start_time: "08:00",
        end_time: "18:00",
      },
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(
      expect.objectContaining({
        weekday: 1,
        weekday_label: "Pazartesi",
        time_range_label: "08:00 - 18:00 • 60 dk ders",
      })
    );

    vi.useRealTimers();
  });

  it("normalizes package rows and derives lesson requirements", () => {
    const result = normalizePackageOptions([
      { id: "pkg-1", title: "Gold", total_credits: 8 },
      { id: "pkg-2", title: "Pro", weekly_class_hours: 5, required_preference_slots: 99, required_trainer_free_slots: 88 },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        weekly_class_hours: 2,
        required_preference_slots: 6,
        required_trainer_free_slots: 4,
        is_available: true,
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        weekly_class_hours: 5,
        required_preference_slots: 99,
        required_trainer_free_slots: 88,
      })
    );
  });

  it("provides stable fallback packages based on selected day count", () => {
    const result = fallbackPackageOptions(3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ id: "starter", total_credits: 4 }));
    expect(result[2]).toEqual(expect.objectContaining({ id: "focus", required_preference_slots: 9 }));
  });

  it("normalizes trainer rows and falls back to salon trainer list", () => {
    const result = normalizeTrainerOptions(undefined, {
      id: "salon-1",
      slug: "demo",
      name: "Demo",
      trainers: [{ id: "tr-1", full_name: "Demo Trainer" }],
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "tr-1",
        full_name: "Demo Trainer",
        specialties: ["Mobilite", "Fonksiyonel"],
        is_available: true,
      }),
    ]);
  });

  it("builds weekday defaults and normalizes unavailable package and trainer rows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T10:00:00.000Z"));

    const fallbackSalon: SalonDiscoverySummary = {
      id: "salon-1",
      slug: "demo",
      name: "Demo",
      business_hours: {},
    };
    const dayOptions = buildSalonDayOptions(fallbackSalon);
    expect(dayOptions).toHaveLength(6);
    expect(dayOptions[0]).toEqual(
      expect.objectContaining({
        weekday: 1,
        time_range_label: "09:00 - 20:00 • 60 dk ders",
      })
    );

    const packages = normalizePackageOptions([
      { id: "pkg-1", title: "", total_credits: 0, is_available: false, unavailable_reason: "Dolu" },
    ]);
    expect(packages[0]).toEqual(
      expect.objectContaining({
        title: "Paket 1",
        weekly_class_hours: 1,
        required_preference_slots: 3,
        required_trainer_free_slots: 2,
        is_available: false,
        unavailable_reason: "Dolu",
      })
    );

    const trainers = normalizeTrainerOptions([
      {
        id: "tr-1",
        full_name: "",
        matching_slots: 2,
        required_matching_slots: 4,
      } as TrainerOption,
    ]);
    expect(trainers[0]).toEqual(
      expect.objectContaining({
        full_name: "Eğitmen 1",
        matching_slots: 2,
        required_matching_slots: 4,
        avatar_label: "E1",
      })
    );

    vi.useRealTimers();
  });
});
