import { describe, expect, it } from "vitest";
import { catalogLabelForCode, catalogParentLabelForCode, derivePackageFromCatalog, enrichPackageRowForDisplay, normalizeLessonCatalogServices } from "../services/package.service";
import { PackageType } from "../entities/package.entity";

describe("enrichPackageRowForDisplay defaults", () => {
  it("defaults group packages to multi-select and drop-in enabled when explicit rules are absent", () => {
    const result = enrichPackageRowForDisplay(
      {
        id: "pkg-1",
        tenant_id: "tenant-1",
        title: "Grup Dersi (8 Kisi)",
        type: PackageType.GROUP,
        total_credits: 8,
        duration_days: 30,
        capacity: 8,
        display_price: "200.00",
        rules: {},
        is_active: true,
        is_visible: true,
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
      []
    );

    expect(result.lesson_mode).toBe("GROUP");
    expect(result.allow_member_multi_select).toBe(true);
    expect(result.allow_drop_in_booking).toBe(true);
  });

  it("keeps manual capacity and commission overrides when creating from catalog", () => {
    const result = derivePackageFromCatalog(
      [
        {
          code: "REFORMER_ADVANCED",
          title: "Reformer Advanced",
          description: "",
          active: true,
          starting_price: "900.00",
          trainer_commission_rate: "25.00",
          capacity_label: "1-2 kişi",
          package_type: "REFORMER",
          category_group: "Pilates",
          lesson_mode: "DUO",
          sub_lessons: [],
          session_duration_minutes: 50,
          break_duration_minutes: 10,
        },
      ],
      {
        serviceKey: "REFORMER_ADVANCED",
        explicitCapacity: 4,
        explicitCommissionRate: 35,
        explicitDisplayPrice: 1200,
        lessonMode: "GROUP",
      }
    );

    expect(result.capacity).toBe(4);
    expect(result.displayPrice).toBe("1200.00");
    expect(result.rules.trainer_commission_rate).toBe(35);
    expect(result.rules.lesson_mode).toBe("GROUP");
  });

  it("normalizes custom main and sub category aliases from saved catalog rows", () => {
    const item = normalizeLessonCatalogServices([
      {
        main_category: "Klinik Pilates",
        sub_category: "Reformer Başlangıç",
        starting_price: "850",
        trainer_commission_rate: "30",
        capacity_label: "1-2 kişi",
        package_type: "REFORMER",
      },
    ]).find((row) => row.code === "REFORMER_BASLANGIC");

    expect(item?.code).toBe("REFORMER_BASLANGIC");
    expect(item?.title).toBe("Reformer Başlangıç");
    expect(item?.category_group).toBe("Klinik Pilates");
    expect(item?.lesson_mode).toBe("DUO");
  });

  it("maps supported package category codes to Turkish parent and child labels", () => {
    expect(catalogParentLabelForCode("CHILD_YOGA")).toBe("Çocuk");
    expect(catalogLabelForCode("CHILD_YOGA")).toBe("Çocuk yogası");
    expect(catalogParentLabelForCode("PILATES_YOGA")).toBe("Pilates");
    expect(catalogLabelForCode("PILATES_YOGA")).toBe("Pilates Yoga");
    expect(catalogParentLabelForCode("PEDIATRIC")).toBe("Çocuk");
    expect(catalogLabelForCode("PEDIATRIC")).toBe("Pediatrik destek");
  });
});
