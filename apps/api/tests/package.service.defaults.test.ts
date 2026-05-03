import { describe, expect, it } from "vitest";
import { enrichPackageRowForDisplay } from "../services/package.service";
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
});
