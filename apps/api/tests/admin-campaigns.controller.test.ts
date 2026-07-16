import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCampaignsController } from "../controllers/admin/campaigns.controller";
import {
  CampaignAudience,
  CampaignFulfillmentType,
  CampaignRewardTarget,
  CampaignRewardType,
  CampaignTriggerType,
} from "../entities/campaign.entity";
import { AppDataSource } from "../data-source";
import { CampaignEngineService } from "../services/campaign-engine.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin campaigns controller", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists campaign rules with fulfillment summary", async () => {
    const campaign = {
      id: "6b474a08-a765-4c57-aeca-63f90aaa5923",
      tenant_id: "tenant-1",
      name: "Referans",
      audience: CampaignAudience.ALL,
      audience_config: {},
      trigger_type: CampaignTriggerType.REFERRAL,
      trigger_count: 2,
      reward_type: CampaignRewardType.GROUP_CLASS_CREDIT,
      reward_value: 1,
      reward_target: CampaignRewardTarget.REFERRER,
      fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    vi.spyOn(CampaignEngineService, "list").mockResolvedValue([campaign]);
    vi.spyOn(CampaignEngineService, "withFulfillmentSummary").mockResolvedValue([
      Object.assign(campaign, { fulfillment_count: 3, fulfilled_credits: 3, last_fulfilled_at: new Date() }),
    ]);

    const res = createMockResponse();
    await AdminCampaignsController.list({ tenantId: "tenant-1" } as any, res as any);

    expect(res.body).toEqual({ data: expect.objectContaining({
      summary: { total: 1, active: 1, referral: 1, loyalty: 0 },
      items: [expect.objectContaining({ fulfillment_count: 3, target_label: "Referans olan üye" })],
    }) });
  });

  it("creates campaigns passive unless the admin explicitly activates them", async () => {
    const repo = {
      create: vi.fn((row) => ({ id: "6b474a08-a765-4c57-aeca-63f90aaa5923", ...row })),
      save: vi.fn(async (row) => row),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);
    const res = createMockResponse();

    await AdminCampaignsController.create({
      tenantId: "tenant-1",
      auth: { sub: "admin-1" },
      body: {
        name: "Referans Bahar",
        audience: "ALL",
        trigger_type: "REFERRAL",
        trigger_count: 2,
        reward_type: "GROUP_CLASS_CREDIT",
        reward_value: 1,
        reward_target: "BOTH",
      },
    } as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, reward_target: "BOTH" }));
  });

  it("rejects discount rewards until purchase fulfillment exists", async () => {
    await expect(AdminCampaignsController.create({
      tenantId: "tenant-1",
      body: {
        name: "İndirim",
        trigger_type: "ATTENDANCE",
        trigger_count: 3,
        reward_type: "DISCOUNT",
        reward_value: 10,
      },
    } as any, createMockResponse() as any)).rejects.toMatchObject({ code: "CAMPAIGN_REWARD_NOT_FULFILLABLE" });
  });

  it("keeps delivered campaign rules immutable for verifiable reporting", async () => {
    const existing = {
      id: "6b474a08-a765-4c57-aeca-63f90aaa5923",
      tenant_id: "tenant-1",
      name: "Kampanya",
      trigger_type: CampaignTriggerType.ATTENDANCE,
      trigger_count: 3,
      reward_value: 1,
      reward_type: CampaignRewardType.GROUP_CLASS_CREDIT,
      reward_target: CampaignRewardTarget.MEMBER,
      audience: CampaignAudience.ALL,
      audience_config: {},
      fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
      is_active: true,
    } as any;
    vi.spyOn(CampaignEngineService, "ensureLegacyMigrated").mockResolvedValue(undefined);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity.name === "Campaign") return { findOne: vi.fn().mockResolvedValue(existing) } as any;
      return { count: vi.fn().mockResolvedValue(1) } as any;
    });

    await expect(AdminCampaignsController.update({
      tenantId: "tenant-1",
      params: { id: existing.id },
      body: { reward_value: 2 },
    } as any, createMockResponse() as any)).rejects.toMatchObject({
      code: "CAMPAIGN_RULE_IMMUTABLE_AFTER_FULFILLMENT",
      statusCode: 409,
    });
  });
});
