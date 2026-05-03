import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRiskController } from "../controllers/admin/risk.controller";
import { RiskNotificationService } from "../services/risk-notification.service";
import { RiskService } from "../services/risk.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin risk controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes list filters and returns filter metadata", async () => {
    vi.spyOn(RiskService, "listRiskMembers").mockResolvedValue({
      data: [{ member_id: "member-1" }],
      total: 1,
      limit: 25,
    } as any);

    const req = {
      tenantId: "tenant-1",
      query: {
        level: "high",
        riskSegment: "at_risk",
        memberActivity: "active",
        limit: "25",
      },
    } as any;
    const res = createMockResponse();

    await AdminRiskController.listRiskMembers(req, res as any);

    expect(RiskService.listRiskMembers).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      riskSegment: "AT_RISK",
      memberActivity: "ACTIVE",
      onlyActive: false,
      level: "HIGH",
      onlyAtRisk: false,
      limit: 25,
    });
    expect(res.body).toEqual({
      data: [{ member_id: "member-1" }],
      total: 1,
      limit: 25,
      filter_help: {
        default_limit: 100,
        max_limit: 500,
        description: "Limit, listede donen uye sayisini belirler.",
      },
      filters: {
        level: "HIGH",
        riskSegment: "AT_RISK",
        memberActivity: "ACTIVE",
      },
    });
  });

  it("returns member risk detail and validates memberId presence", async () => {
    vi.spyOn(RiskService, "getMemberRiskDetail").mockResolvedValue({
      member_id: "member-1",
      score: 78,
    } as any);

    const req = {
      tenantId: "tenant-1",
      params: { memberId: "member-1" },
    } as any;
    const res = createMockResponse();

    await AdminRiskController.getMemberRiskDetail(req, res as any);

    expect(res.body).toEqual({
      data: {
        member_id: "member-1",
        score: 78,
      },
    });

    await expect(
      AdminRiskController.getMemberRiskDetail({ tenantId: "tenant-1", params: {} } as any, createMockResponse() as any)
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("triggers notifications with normalized defaults and exposes logs", async () => {
    vi.spyOn(RiskNotificationService, "trigger").mockResolvedValue({
      delivered: 2,
      skipped: 1,
    } as any);
    vi.spyOn(RiskNotificationService, "logs").mockResolvedValue({
      data: [{ id: "log-1" }],
      total: 1,
    } as any);

    const triggerReq = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1" },
      body: {
        riskSegment: "unknown",
        memberIds: ["member-1", "member-2"],
      },
    } as any;
    const triggerRes = createMockResponse();

    await AdminRiskController.triggerNotifications(triggerReq, triggerRes as any);

    expect(RiskNotificationService.trigger).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      triggeredByAdminId: "admin-1",
      memberIds: ["member-1", "member-2"],
      riskSegment: "AT_RISK",
    });
    expect(triggerRes.body).toEqual({
      data: {
        delivered: 2,
        skipped: 1,
      },
    });

    const logsReq = {
      tenantId: "tenant-1",
      query: { limit: "5" },
    } as any;
    const logsRes = createMockResponse();

    await AdminRiskController.notificationLogs(logsReq, logsRes as any);

    expect(RiskNotificationService.logs).toHaveBeenCalledWith("tenant-1", 5);
    expect(logsRes.body).toEqual({
      data: [{ id: "log-1" }],
      total: 1,
    });
  });
});
