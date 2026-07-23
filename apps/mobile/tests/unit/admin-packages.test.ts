import { describe, expect, it } from "vitest";
import {
  LESSON_VARIANTS,
  buildVariantDefaults,
  deriveWeeklyRuleSummary,
  filterAdminPackages,
  sanitizeDecimalInput,
  toTestIdSegment,
} from "@/lib/admin-packages";

describe("admin package helpers", () => {
  it("normalizes numeric input and derives weekly requirements", () => {
    expect(sanitizeDecimalInput("1.250,75")).toBe("1.25");
    expect(deriveWeeklyRuleSummary("2")).toEqual({
      weeklyClassHours: 2,
      requiredPreferenceSlots: 6,
      requiredTrainerFreeSlots: 4,
    });
    expect(deriveWeeklyRuleSummary("0")).toBeNull();
    expect(deriveWeeklyRuleSummary("8")).toBeNull();
  });

  it("builds stable defaults from the selected service template", () => {
    const variant = LESSON_VARIANTS.find((item) => item.key === "REFORMER");
    const defaults = buildVariantDefaults(variant, {
      service_key: "REFORMER",
      service_name: "Reformer Pilates",
      category_group: "PILATES",
      category_label: "Pilates",
      sub_category_key: "REFORMER",
      sub_category_label: "Reformer",
      capacity_label: "Birebir",
      suggested_capacity: 1,
      starting_price: "2400",
      trainer_commission_rate: "30",
      package_type: "REFORMER",
    });
    expect(defaults).toMatchObject({
      display_price: "2400",
      trainer_commission_rate: "30",
      capacity: "1",
      weekly_class_hours: "1",
    });
  });

  it("filters packages by text and active state", () => {
    const packages = [
      { id: "1", title: "Reformer Başlangıç", total_credits: 4, duration_days: 30, is_active: true },
      { id: "2", title: "Manuel Terapi", total_credits: 1, duration_days: 7, is_active: false },
    ];
    expect(filterAdminPackages(packages, "reformer", "ACTIVE").map((item) => item.id)).toEqual(["1"]);
    expect(filterAdminPackages(packages, "", "PASSIVE").map((item) => item.id)).toEqual(["2"]);
  });

  it("builds deterministic test ids from Turkish labels", () => {
    expect(toTestIdSegment("Kişisel Antrenman")).toBe("kisisel-antrenman");
    expect(toTestIdSegment("Ücretsiz Ders")).toBe("ucretsiz-ders");
  });
});
