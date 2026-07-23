import { describe, expect, it } from "vitest";
import {
  buildMemberBookingTimeSelectionResult,
  canAddWeeklyPreference,
  countWeeklyPreferenceDays,
} from "@/lib/member-package-time-selection";

describe("buildMemberBookingTimeSelectionResult", () => {
  it("spreads weekly alternatives across days with at most three choices per day", () => {
    const monday = [
      "2026-07-20T07:00:00.000Z",
      "2026-07-20T08:00:00.000Z",
      "2026-07-20T10:00:00.000Z",
    ];
    const tuesday = "2026-07-21T07:00:00.000Z";

    expect(countWeeklyPreferenceDays(monday)).toBe(1);
    expect(canAddWeeklyPreference(monday, "2026-07-20T11:00:00.000Z")).toBe(false);
    expect(canAddWeeklyPreference(monday, tuesday)).toBe(true);
    expect(countWeeklyPreferenceDays([...monday, tuesday])).toBe(2);
  });

  it("preserves slot selections per package and prefixes flattened labels for multi-package flow", () => {
    const result = buildMemberBookingTimeSelectionResult({
      selectedPackages: [
        {
          package_id: "pkg-1",
          package_title: "Grup Dersi (8 Kişi)",
          weekly_class_hours: 1,
          required_preference_slots: 1,
          required_trainer_free_slots: 1,
        },
        {
          package_id: "pkg-2",
          package_title: "Grup Dersi (4 Kişi)",
          weekly_class_hours: 1,
          weekly_frequency: 2,
          required_preference_slots: 1,
          required_trainer_free_slots: 1,
        },
      ],
      selectedSlotIdsByPackage: {
        "pkg-1": ["2025-04-28T09:00:00.000Z"],
        "pkg-2": ["2025-04-29T10:00:00.000Z"],
      },
      slots: [
        {
          starts_at: "2025-04-28T09:00:00.000Z",
          ends_at: "2025-04-28T10:00:00.000Z",
          label: "Pazartesi • 09:00",
        },
        {
          starts_at: "2025-04-29T10:00:00.000Z",
          ends_at: "2025-04-29T11:00:00.000Z",
          label: "Salı • 10:00",
        },
      ],
      includePackageTitle: true,
    });

    expect(result.nextSelectedPackages).toHaveLength(2);
    expect(result.nextSelectedPackages[0].weekly_frequency).toBe(1);
    expect(result.nextSelectedPackages[1].weekly_frequency).toBe(2);
    expect(result.nextSelectedPackages[0].preferred_slots).toEqual([
      {
        starts_at: "2025-04-28T09:00:00.000Z",
        ends_at: "2025-04-28T10:00:00.000Z",
        label: "Pazartesi • 09:00",
        package_id: "pkg-1",
        package_title: "Grup Dersi (8 Kişi)",
      },
    ]);
    expect(result.nextSelectedPackages[1].preferred_slots).toEqual([
      {
        starts_at: "2025-04-29T10:00:00.000Z",
        ends_at: "2025-04-29T11:00:00.000Z",
        label: "Salı • 10:00",
        package_id: "pkg-2",
        package_title: "Grup Dersi (4 Kişi)",
      },
    ]);
    expect(result.flattenedSlots).toEqual([
      {
        starts_at: "2025-04-28T09:00:00.000Z",
        ends_at: "2025-04-28T10:00:00.000Z",
        label: "Grup Dersi (8 Kişi) • Pazartesi • 09:00",
        package_id: "pkg-1",
        package_title: "Grup Dersi (8 Kişi)",
      },
      {
        starts_at: "2025-04-29T10:00:00.000Z",
        ends_at: "2025-04-29T11:00:00.000Z",
        label: "Grup Dersi (4 Kişi) • Salı • 10:00",
        package_id: "pkg-2",
        package_title: "Grup Dersi (4 Kişi)",
      },
    ]);
  });
});
