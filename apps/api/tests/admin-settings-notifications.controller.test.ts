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

  it("returns provider receipt, retry and failure details in notification logs", async () => {
    const eventRepo = {
      find: vi.fn().mockResolvedValue([{
        id: "event-1",
        type: "MOBILE_PUSH",
        status: "FAILED",
        created_at: new Date("2026-07-16T10:00:00.000Z"),
        processed_at: new Date("2026-07-16T10:01:00.000Z"),
        error_message: "1 push teslimatı başarısız oldu",
        member_id: "member-1",
        payload: {
          title: "Ders hatırlatması",
          body: "Dersiniz yaklaşıyor",
          delivery_summary: { queued: 0, awaiting_receipt: 0, delivered: 0, failed: 1 },
        },
      }]),
    };
    const userRepo = {
      find: vi.fn().mockResolvedValue([{ id: "member-1", first_name: "Ada", last_name: "Yılmaz", email: "ada@example.com" }]),
    };
    const deliveryRepo = {
      find: vi.fn().mockResolvedValue([{
        id: "delivery-1",
        event_id: "event-1",
        channel: "EXPO_PUSH",
        status: "FAILED",
        platform: "IOS",
        attempt_count: 4,
        provider_ticket_id: "ticket-1",
        error_message: "DeviceNotRegistered",
      }]),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return eventRepo as any;
      if (name.includes("NotificationDelivery")) return deliveryRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    const res = createMockResponse();

    await AdminSettingsController.notificationLogs({ tenantId: "tenant-1", query: {} } as any, res as any);

    expect(res.body.data[0]).toEqual(expect.objectContaining({
      delivery_summary: { queued: 0, awaiting_receipt: 0, delivered: 0, failed: 1 },
      deliveries: [expect.objectContaining({
        status: "FAILED",
        attempt_count: 4,
        provider_ticket_id: "ticket-1",
        error_message: "DeviceNotRegistered",
      })],
    }));
  });
});
