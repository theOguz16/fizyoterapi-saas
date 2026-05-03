import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCampaignsController } from "../controllers/admin/campaigns.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("admin campaigns controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists normalized campaign collections and derived summary", async () => {
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "profile-1",
        tenant_id: "tenant-1",
        location: {
          campaigns: {
            referral_campaigns: [
              {
                id: "ref-1",
                required_referrals: 2,
                reward_type: "FREE_CLASS",
                reward_value: 1,
                reward_label: "1 ücretsiz ders",
                is_active: true,
              },
            ],
            loyalty_campaigns: [
              {
                id: "loy-1",
                min_lessons: 5,
                reward_type: "GROUP_CLASS_CREDIT",
                reward_value: 1,
                reward_label: "1 kredi",
                is_active: false,
              },
            ],
          },
          campaign_audit: [{ id: "audit-1", action: "CAMPAIGN_CREATED", summary: "Kampanya oluşturuldu", created_at: "2026-04-23T09:00:00.000Z" }],
        },
      }),
      save: vi.fn(),
      create: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonProfile")) return profileRepo as any;
      return {
        findOne: vi.fn().mockResolvedValue(null),
      } as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await AdminCampaignsController.list(req, res as any);

    expect(res.body).toEqual({
      data: expect.objectContaining({
        summary: {
          total: 2,
          active: 1,
          referral: 1,
          loyalty: 1,
        },
        audit: [expect.objectContaining({ id: "audit-1" })],
      }),
    });
  });

  it("creates a referral campaign with derived reward label", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1777000000000);

    const profile = {
      id: "profile-1",
      tenant_id: "tenant-1",
      location: {
        campaigns: {
          referral_campaigns: [],
          loyalty_campaigns: [],
          cancellation_policy: {
            min_hours_before_start: 3,
            refund_policy: "NO_REFUND",
          },
        },
        campaign_audit: [],
      },
    };
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue(profile),
      save: vi.fn().mockImplementation(async (row) => row),
      create: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonProfile")) return profileRepo as any;
      return {
        findOne: vi.fn().mockResolvedValue(null),
      } as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1" },
      body: {
        name: "Referans Bahar",
        audience: "ALL",
        trigger_type: "REFERRAL",
        trigger_count: 2,
        reward_type: "FREE_CLASS",
        reward_value: 1,
        reward_target: "REFERRER",
        is_active: true,
      },
    } as any;
    const res = createMockResponse();

    await AdminCampaignsController.create(req, res as any);

    expect(profileRepo.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        campaign: expect.objectContaining({
          name: "Referans Bahar",
          reward_label: "2 referans sonrası referans olana 1 ücretsiz grup dersi",
        }),
      }),
    });
  });
});
