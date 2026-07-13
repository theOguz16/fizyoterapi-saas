import { describe, expect, it } from "vitest";
import {
  resolveCalendarEmptyState,
  resolveDashboardEmptyState,
  resolveMembersEmptyState,
  resolvePackagesEmptyState,
} from "@/lib/admin-empty-states";

describe("admin empty state actions", () => {
  it("directs a new clinic to package creation and member invitation", () => {
    expect(resolvePackagesEmptyState(0)).toMatchObject({ action: "SELECT_PACKAGE_TYPE" });
    expect(resolveMembersEmptyState(false)).toMatchObject({ action: "OPEN_QR" });
    expect(resolveDashboardEmptyState(0)).toMatchObject({ route: "/(admin)/clinic-qr" });
  });

  it("directs an unconfigured calendar to working hours", () => {
    expect(resolveCalendarEmptyState(false)).toMatchObject({
      route: "/(admin)/working-hours",
      actionLabel: "Çalışma saatlerini ayarla",
    });
  });

  it("directs an empty configured calendar to the first member invitation", () => {
    expect(resolveCalendarEmptyState(true)).toMatchObject({
      route: "/(admin)/clinic-qr",
      actionLabel: "İlk danışanını davet et",
    });
  });

  it("clears filters instead of starting a new record when filtered results are empty", () => {
    expect(resolveMembersEmptyState(true)).toMatchObject({ action: "CLEAR_FILTERS" });
    expect(resolvePackagesEmptyState(2)).toMatchObject({ action: "CLEAR_FILTERS" });
  });
});
