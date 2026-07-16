import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import {
  CampaignAudience,
  CampaignFulfillmentType,
  CampaignRewardTarget,
  CampaignRewardType,
  CampaignTriggerType,
} from "../entities/campaign.entity";
import { CampaignEngineService } from "../services/campaign-engine.service";
import { MemberCreditWalletService } from "../services/member-credit-wallet.service";
import { MobileNotificationService } from "../services/mobile-notification.service";

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "6b474a08-a765-4c57-aeca-63f90aaa5923",
    tenant_id: "tenant-1",
    name: "Kampanya",
    audience: CampaignAudience.ALL,
    audience_config: {},
    trigger_type: CampaignTriggerType.ATTENDANCE,
    trigger_count: 3,
    reward_type: CampaignRewardType.GROUP_CLASS_CREDIT,
    reward_value: 1,
    reward_target: CampaignRewardTarget.MEMBER,
    fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
    is_active: true,
    ...overrides,
  } as any;
}

describe("campaign engine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("imports no automatic default and ignores unsupported legacy discounts", () => {
    const rows = (CampaignEngineService as any).readLegacyRows([
      { id: "ref-default-2", required_referrals: 2, reward_type: "FREE_CLASS", reward_value: 1, is_active: true },
      { id: "discount-1", required_referrals: 2, reward_type: "DISCOUNT", reward_value: 10, is_active: true },
      { id: "real-1", required_referrals: 2, reward_type: "FREE_CLASS", reward_value: 1 },
    ], CampaignTriggerType.REFERRAL);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ legacy_id: "real-1", is_active: false, reward_type: "GROUP_CLASS_CREDIT" });
  });

  it("applies the risk audience using the latest retention score", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity.name === "User") return { findOne: vi.fn().mockResolvedValue({ id: "member-1", created_at: new Date() }) } as any;
      if (entity.name === "RetentionScore") return { findOne: vi.fn().mockResolvedValue({ score: 69 }) } as any;
      throw new Error(`Unexpected repository ${entity.name}`);
    });

    await expect((CampaignEngineService as any).isAudienceEligible(
      campaign({ audience: CampaignAudience.RISK }), "member-1"
    )).resolves.toBe(true);
  });

  it("does not include an old member in the NEW audience", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "member-1", created_at: new Date("2020-01-01") }),
    } as any);

    await expect((CampaignEngineService as any).isAudienceEligible(
      campaign({ audience: CampaignAudience.NEW }), "member-1"
    )).resolves.toBe(false);
  });

  it("runs attendance fulfillment only after the configured threshold", async () => {
    vi.spyOn(CampaignEngineService, "list").mockResolvedValue([campaign()]);
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({ count: vi.fn().mockResolvedValue(3) } as any);
    const fulfill = vi.spyOn(CampaignEngineService as any, "fulfill").mockResolvedValue(true);

    await expect(CampaignEngineService.processAttendance("tenant-1", "member-1")).resolves.toBe(1);
    expect(fulfill).toHaveBeenCalledOnce();
  });

  it("does not deliver the same campaign twice to a member", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "existing-ledger" }),
    } as any);

    await expect((CampaignEngineService as any).fulfill(campaign(), "member-1", "MANUAL_ADJUST")).resolves.toBe(false);
  });

  it("treats a concurrent unique fulfillment as already delivered", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => ({
      findOne: vi.fn().mockResolvedValue(entity.name === "User" ? { id: "member-1", created_at: new Date() } : null),
    }) as any);
    vi.spyOn(MemberCreditWalletService, "addCredits").mockRejectedValue({ code: "23505" });
    const push = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: 0 } as any);

    await expect((CampaignEngineService as any).fulfill(campaign(), "member-1", "MANUAL_ADJUST")).resolves.toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
