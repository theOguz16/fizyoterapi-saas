import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSettingsController } from "../controllers/admin/settings.controller";
import { AppDataSource } from "../data-source";
import { RiskService } from "../services/risk.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin settings notification trigger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("targets at-risk members and keeps member identity in notification logs", async () => {
    const templateRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "tpl-1",
        type: "PACKAGE_ENDING",
        title: "Paket yenileme zamanı",
        body: "Paketini birlikte yenileyelim.",
        settings: {},
      }),
    };
    const userRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "member-1",
          first_name: "Ayşe",
          last_name: "Yılmaz",
          email: "ayse@example.com",
        },
      ]),
    };
    const eventRepo = {
      create: vi.fn().mockImplementation((payload) => ({ id: `event-${payload.member_id}`, ...payload })),
      save: vi.fn().mockImplementation(async (payload) => payload),
    };
    const deliveryRepo = {
      create: vi.fn().mockImplementation((payload) => ({ id: `delivery-${payload.member_id}`, ...payload })),
      save: vi.fn().mockImplementation(async (payload) => payload),
    };

    vi.spyOn(RiskService, "listRiskMembers").mockResolvedValue({
      data: [{ member_id: "member-1" }],
      total: 1,
      limit: 1,
    } as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationTemplate")) return templateRepo as any;
      if (name.includes("User")) return userRepo as any;
      if (name.includes("NotificationEvent")) return eventRepo as any;
      if (name.includes("NotificationDelivery")) return deliveryRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1" },
      body: {
        type: "PACKAGE_ENDING",
        audience: "AT_RISK",
      },
    } as any;
    const res = createMockResponse();

    await AdminSettingsController.triggerTemplate(req, res as any);

    expect(RiskService.listRiskMembers).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      riskSegment: "AT_RISK",
      memberActivity: "ACTIVE",
      limit: 500,
    });
    expect(eventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: "member-1",
        payload: expect.objectContaining({
          audience: "AT_RISK",
          member_full_name: "Ayşe Yılmaz",
          member_email: "ayse@example.com",
        }),
      })
    );
    expect(res.body).toEqual({
      data: expect.objectContaining({
        audience: "AT_RISK",
        total_targeted: 1,
        events_created: 1,
      }),
    });
  });
});
