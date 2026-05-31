import { describe, expect, it } from "vitest";
import { buildAdminApprovalCounts, getAdminApprovalStatusMeta } from "@/lib/admin-approvals";

describe("admin approvals helpers", () => {
  it("builds counts from dashboard kpis first and row fallbacks second", () => {
    const rows = [
      { type: "APPLICATION" },
      { type: "PAYMENT" },
      { type: "CHANGE_REQUEST" },
      { type: "CHANGE_REQUEST" },
    ];

    expect(buildAdminApprovalCounts(rows, { pending_applications: 5, pending_payments: 3 })).toEqual({
      pendingApplications: 5,
      pendingPayments: 3,
      changeRequests: 2,
    });

    expect(buildAdminApprovalCounts(rows, null)).toEqual({
      pendingApplications: 1,
      pendingPayments: 1,
      changeRequests: 2,
    });
  });

  it("maps approval statuses to icon and tone metadata", () => {
    expect(getAdminApprovalStatusMeta("APPROVED")).toEqual({
      iconName: "approvals",
      tone: "success",
      label: "Onaylandı",
    });
    expect(getAdminApprovalStatusMeta("REJECTED")).toEqual({
      iconName: "risk",
      tone: "danger",
      label: "Reddedildi",
    });
    expect(getAdminApprovalStatusMeta("PENDING")).toEqual({
      iconName: "request",
      tone: "warning",
      label: "Bekliyor",
    });
  });

  it("treats unknown statuses as pending and counts missing dashboard kpis from rows", () => {
    expect(
      buildAdminApprovalCounts(
        [{ type: "APPLICATION" }, { type: "APPLICATION" }, { type: "CHANGE_REQUEST" }, { type: "PAYMENT" }],
        {}
      )
    ).toEqual({
      pendingApplications: 2,
      pendingPayments: 1,
      changeRequests: 1,
    });
    expect(getAdminApprovalStatusMeta("IN_REVIEW")).toEqual({
      iconName: "request",
      tone: "warning",
      label: "Bekliyor",
    });
  });
});
