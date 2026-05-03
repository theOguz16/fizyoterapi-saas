import { describe, expect, it } from "vitest";
import {
  applicationStageLabel,
  applicationStageVariant,
  filterApplicationsByStage,
  parseApplicationNote,
} from "@/app/admin/applications/application-utils";

describe("application utils", () => {
  const rows = [
    { id: "a1", status: "PENDING", payment_status: "UNPAID" },
    { id: "a2", status: "APPROVED", payment_status: "UNPAID" },
    { id: "a3", status: "APPROVED", payment_status: "VERIFIED" },
    { id: "a4", status: "REJECTED", payment_status: "REJECTED" },
  ];

  it("maps application stages to labels and badge variants", () => {
    expect(applicationStageLabel(rows[0])).toBe("Başvurdu");
    expect(applicationStageLabel(rows[1])).toBe("Ödeme Bekliyor");
    expect(applicationStageLabel(rows[2])).toBe("Salona Katıldı");
    expect(applicationStageVariant(rows[3])).toBe("danger");
  });

  it("filters application rows by admin funnel stage", () => {
    expect(filterApplicationsByStage(rows, "ALL")).toHaveLength(4);
    expect(filterApplicationsByStage(rows, "PENDING").map((row) => row.id)).toEqual(["a1"]);
    expect(filterApplicationsByStage(rows, "PAYMENT").map((row) => row.id)).toEqual(["a2"]);
    expect(filterApplicationsByStage(rows, "JOINED").map((row) => row.id)).toEqual(["a3"]);
    expect(filterApplicationsByStage(rows, "REJECTED").map((row) => row.id)).toEqual(["a4"]);
  });

  it("splits note bullets into readable lines", () => {
    expect(parseApplicationNote("Ilk satir • Ikinci satir · Ucuncu satir")).toEqual([
      "Ilk satir",
      "Ikinci satir",
      "Ucuncu satir",
    ]);
  });
});
