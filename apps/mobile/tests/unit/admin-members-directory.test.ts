import { describe, expect, it } from "vitest";
import {
  buildAdminDirectory,
  filterAdminDirectory,
  getAdminDirectoryMetrics,
  getDirectoryRiskLabel,
} from "@/lib/admin-members-directory";

describe("admin members directory", () => {
  const items = buildAdminDirectory(
    [
      { id: "member-1", first_name: "İrem", last_name: "Aksoy", is_active: true },
      { id: "member-2", first_name: "Can", last_name: "Kaya", is_active: false, retention_score: 35, risk_reason: "Katılım azaldı" },
    ],
    [{ id: "trainer-1", first_name: "Ece", last_name: "Yılmaz", is_active: true }],
  );

  it("combines members and trainers without losing their role", () => {
    expect(items.map((item) => [item.id, item.role])).toEqual([
      ["member-1", "MEMBER"],
      ["member-2", "MEMBER"],
      ["trainer-1", "TRAINER"],
    ]);
    expect(getAdminDirectoryMetrics(items)).toEqual({ total: 3, active: 2, trainers: 1, members: 2 });
  });

  it("applies role, status and Turkish search filters deterministically", () => {
    expect(filterAdminDirectory(items, { search: "irem", status: "ACTIVE", role: "MEMBER" }).map((item) => item.id)).toEqual(["member-1"]);
    expect(filterAdminDirectory(items, { search: "", status: "RISK", role: "ALL" }).map((item) => item.id)).toEqual(["member-2"]);
    expect(getDirectoryRiskLabel(items[1])).toBe("Katılım azaldı");
  });

  it("does not count an INACTIVE status as active", () => {
    const statusOnly = buildAdminDirectory([{ id: "member-3", status: "INACTIVE" }], []);
    expect(getAdminDirectoryMetrics(statusOnly).active).toBe(0);
  });
});
