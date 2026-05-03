import { describe, expect, it } from "vitest";
import { buildAdminDashboardMetrics } from "@/lib/admin-dashboard";

describe("admin dashboard helpers", () => {
  it("builds admin dashboard metrics from API payload", () => {
    expect(
      buildAdminDashboardMetrics({
        kpis: {
          active_trainers: 2,
          active_members: 18,
          at_risk_members: 3,
          todays_bookings: 9,
        },
        revenue: {
          daily: 1250,
          weekly: 5200,
          monthly: 18300,
        },
        leads: {
          by_status: {
            NEW: 4,
            CONTACTED: 6,
            WON: 2,
            LOST: 1,
          },
        },
        risk_preview: [{ id: "r1" }, { id: "r2" }],
      })
    ).toEqual({
      activeTrainers: 2,
      activeMembers: 18,
      atRiskMembers: 3,
      todaysBookings: 9,
      dailyRevenue: 1250,
      weeklyRevenue: 5200,
      monthlyRevenue: 18300,
      newLeads: 4,
      contactedLeads: 6,
      wonLeads: 2,
      lostLeads: 1,
      riskPreviewCount: 2,
    });
  });

  it("falls back to zero values when payload is missing", () => {
    expect(buildAdminDashboardMetrics(null)).toEqual({
      activeTrainers: 0,
      activeMembers: 0,
      atRiskMembers: 0,
      todaysBookings: 0,
      dailyRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      newLeads: 0,
      contactedLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      riskPreviewCount: 0,
    });
  });

  it("coerces numeric revenue strings and ignores invalid risk payloads", () => {
    expect(
      buildAdminDashboardMetrics({
        revenue: {
          daily: "1200.5" as unknown as number,
          weekly: "0" as unknown as number,
          monthly: null,
        },
        risk_preview: {} as unknown[],
      })
    ).toEqual({
      activeTrainers: 0,
      activeMembers: 0,
      atRiskMembers: 0,
      todaysBookings: 0,
      dailyRevenue: 1200.5,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      newLeads: 0,
      contactedLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      riskPreviewCount: 0,
    });
  });
});
