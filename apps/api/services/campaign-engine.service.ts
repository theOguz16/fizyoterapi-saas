import { AppDataSource } from "../data-source";
import { Attendance, AttendanceResult } from "../entities/attendance.entity";
import {
  Campaign,
  CampaignAudience,
  CampaignFulfillmentType,
  CampaignRewardTarget,
  CampaignRewardType,
  CampaignTriggerType,
} from "../entities/campaign.entity";
import { CreditLedger, CreditLedgerSource } from "../entities/credit-ledger.entity";
import { Referral, ReferralStatus } from "../entities/referral.entity";
import { RetentionScore } from "../entities/retention-score.entity";
import { SalonProfile } from "../entities/salon-profile.entity";
import { User, UserRole } from "../entities/user.entity";
import { MemberCreditWalletService } from "./member-credit-wallet.service";
import { MobileNotificationService } from "./mobile-notification.service";

const DEFAULT_NEW_MEMBER_DAYS = 30;
const DEFAULT_RISK_SCORE_MAX = 69;

export type CampaignRuleView = Campaign & {
  audience_label: string;
  trigger_label: string;
  reward_label: string;
  target_label: string;
  fulfillment_label: string;
  fulfillment_count: number;
  fulfilled_credits: number;
  last_fulfilled_at: Date | null;
};

export class CampaignEngineService {
  static normalizeAudience(value: unknown): CampaignAudience {
    const normalized = String(value ?? "").toUpperCase();
    if (normalized === CampaignAudience.RISK || normalized === CampaignAudience.NEW) return normalized;
    return CampaignAudience.ALL;
  }

  static normalizeTrigger(value: unknown): CampaignTriggerType | null {
    const normalized = String(value ?? "").toUpperCase();
    if (normalized === CampaignTriggerType.REFERRAL || normalized === CampaignTriggerType.ATTENDANCE) {
      return normalized;
    }
    return null;
  }

  static normalizeTarget(value: unknown, trigger: CampaignTriggerType): CampaignRewardTarget {
    if (trigger === CampaignTriggerType.ATTENDANCE) return CampaignRewardTarget.MEMBER;
    const normalized = String(value ?? "").toUpperCase();
    if (
      normalized === CampaignRewardTarget.REFERRER ||
      normalized === CampaignRewardTarget.REFERRED ||
      normalized === CampaignRewardTarget.BOTH
    ) {
      return normalized;
    }
    return CampaignRewardTarget.REFERRER;
  }

  static isSupportedReward(value: unknown) {
    const normalized = String(value ?? "").toUpperCase();
    return normalized === "FREE_CLASS" || normalized === CampaignRewardType.GROUP_CLASS_CREDIT;
  }

  static buildRuleLabels(campaign: Campaign) {
    const audienceLabel = {
      [CampaignAudience.ALL]: "Tüm aktif üyeler",
      [CampaignAudience.RISK]: `Risk skoru ${campaign.audience_config?.risk_score_max ?? DEFAULT_RISK_SCORE_MAX} ve altındaki üyeler`,
      [CampaignAudience.NEW]: `Son ${campaign.audience_config?.new_member_days ?? DEFAULT_NEW_MEMBER_DAYS} günde katılan üyeler`,
    }[campaign.audience];
    const triggerLabel = campaign.trigger_type === CampaignTriggerType.REFERRAL
      ? `${campaign.trigger_count} başarılı referans tamamlandığında`
      : `${campaign.trigger_count} başarılı check-in tamamlandığında`;
    const targetLabel = {
      [CampaignRewardTarget.REFERRER]: "Referans olan üye",
      [CampaignRewardTarget.REFERRED]: "Yeni katılan üye",
      [CampaignRewardTarget.BOTH]: "Her iki üye",
      [CampaignRewardTarget.MEMBER]: "Check-in yapan üye",
    }[campaign.reward_target];

    return {
      audience_label: audienceLabel,
      trigger_label: triggerLabel,
      reward_label: `${campaign.reward_value} ücretsiz grup dersi kredisi`,
      target_label: targetLabel,
      fulfillment_label: "Koşul sağlanınca üyenin grup dersi kredi cüzdanına bir kez otomatik eklenir.",
    };
  }

  static async ensureLegacyMigrated(tenantId: string) {
    const campaignRepo = AppDataSource.getRepository(Campaign);
    if (await campaignRepo.count({ where: { tenant_id: tenantId } })) return;

    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "location"],
    });
    const location = profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
      ? profile.location as Record<string, unknown>
      : {};
    const rawCampaigns = location.campaigns && typeof location.campaigns === "object" && !Array.isArray(location.campaigns)
      ? location.campaigns as Record<string, unknown>
      : {};
    const rows = [
      ...CampaignEngineService.readLegacyRows(rawCampaigns.referral_campaigns, CampaignTriggerType.REFERRAL),
      ...CampaignEngineService.readLegacyRows(rawCampaigns.loyalty_campaigns, CampaignTriggerType.ATTENDANCE),
    ];
    if (rows.length) await campaignRepo.save(rows.map((row) => campaignRepo.create({ tenant_id: tenantId, ...row })));
  }

  private static readLegacyRows(value: unknown, trigger: CampaignTriggerType) {
    if (!Array.isArray(value)) return [];

    return value.flatMap((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const legacyId = String(row.id ?? `${trigger.toLowerCase()}-${index + 1}`).trim();
      if (!CampaignEngineService.isSupportedReward(row.reward_type) || legacyId.startsWith("ref-default")) return [];
      const triggerCount = Math.floor(Number(
        trigger === CampaignTriggerType.REFERRAL ? row.required_referrals : row.min_lessons
      ));
      const rewardValue = Math.floor(Number(row.reward_value));
      if (triggerCount < 1 || rewardValue < 1) return [];

      return [{
        legacy_id: legacyId,
        name: String(row.name ?? row.reward_label ?? "Kampanya").trim() || "Kampanya",
        audience: CampaignEngineService.normalizeAudience(row.audience),
        audience_config: {},
        trigger_type: trigger,
        trigger_count: triggerCount,
        reward_type: CampaignRewardType.GROUP_CLASS_CREDIT,
        reward_value: rewardValue,
        reward_target: CampaignEngineService.normalizeTarget(row.reward_target, trigger),
        fulfillment_type: CampaignFulfillmentType.MEMBER_CREDIT_WALLET,
        is_active: row.is_active === true,
        activated_at: row.is_active === true ? new Date() : null,
      }];
    });
  }

  static async list(tenantId: string, triggerType?: CampaignTriggerType, activeOnly = false) {
    await CampaignEngineService.ensureLegacyMigrated(tenantId);
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (triggerType) where.trigger_type = triggerType;
    if (activeOnly) where.is_active = true;
    return AppDataSource.getRepository(Campaign).find({ where, order: { created_at: "DESC" } });
  }

  static async withFulfillmentSummary(campaigns: Campaign[]): Promise<CampaignRuleView[]> {
    return Promise.all(campaigns.map(async (campaign) => {
      const summary = await AppDataSource.getRepository(CreditLedger)
        .createQueryBuilder("ledger")
        .select("COUNT(ledger.id)", "count")
        .addSelect("COALESCE(SUM(ledger.delta), 0)", "credits")
        .addSelect("MAX(ledger.created_at)", "last_at")
        .where("ledger.tenant_id = :tenantId", { tenantId: campaign.tenant_id })
        .andWhere("ledger.reference_type = :referenceType", { referenceType: "CAMPAIGN" })
        .andWhere("ledger.reference_id = :campaignId", { campaignId: campaign.id })
        .getRawOne<{ count: string; credits: string; last_at: string | null }>();
      return Object.assign(campaign, CampaignEngineService.buildRuleLabels(campaign), {
        fulfillment_count: Number(summary?.count ?? 0),
        fulfilled_credits: Number(summary?.credits ?? 0),
        last_fulfilled_at: summary?.last_at ? new Date(summary.last_at) : null,
      });
    }));
  }

  private static async isAudienceEligible(campaign: Campaign, memberId: string) {
    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: campaign.tenant_id, id: memberId, role: UserRole.MEMBER, is_active: true },
    });
    if (!member) return false;
    if (campaign.audience === CampaignAudience.ALL) return true;
    if (campaign.audience === CampaignAudience.NEW) {
      const days = campaign.audience_config?.new_member_days ?? DEFAULT_NEW_MEMBER_DAYS;
      return member.created_at.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
    }
    const score = await AppDataSource.getRepository(RetentionScore).findOne({
      where: { tenant_id: campaign.tenant_id, member_id: memberId },
      order: { calculated_at: "DESC" },
    });
    return Boolean(score && score.score <= (campaign.audience_config?.risk_score_max ?? DEFAULT_RISK_SCORE_MAX));
  }

  private static async fulfill(campaign: Campaign, memberId: string, source: CreditLedgerSource) {
    const ledgerRepo = AppDataSource.getRepository(CreditLedger);
    const existing = await ledgerRepo.findOne({
      where: { tenant_id: campaign.tenant_id, member_id: memberId, reference_type: "CAMPAIGN", reference_id: campaign.id },
    });
    if (existing || !(await CampaignEngineService.isAudienceEligible(campaign, memberId))) return false;

    try {
      await MemberCreditWalletService.addCredits({
        tenantId: campaign.tenant_id,
        memberId,
        amount: campaign.reward_value,
        source,
        referenceType: "CAMPAIGN",
        referenceId: campaign.id,
        meta: {
          campaign_id: campaign.id,
          trigger_type: campaign.trigger_type,
          reward_type: campaign.reward_type,
          reward_target: campaign.reward_target,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") return false;
      throw error;
    }
    await MobileNotificationService.queuePush({
      tenantId: campaign.tenant_id,
      userId: memberId,
      roleScope: "MEMBER",
      type: "CAMPAIGN_REWARD_EARNED",
      title: "Kampanya ödülü kazandın",
      body: `${campaign.reward_value} ücretsiz grup dersi kredin hesabına eklendi.`,
      deepLink: "/(member)/campaigns",
      meta: { campaign_id: campaign.id, reward_type: campaign.reward_type, reward_value: campaign.reward_value },
    });
    return true;
  }

  static async processReferral(tenantId: string, inviterId: string, referredMemberId: string) {
    const campaigns = await CampaignEngineService.list(tenantId, CampaignTriggerType.REFERRAL, true);
    const qualified = await AppDataSource.getRepository(Referral).count({
      where: { tenant_id: tenantId, inviter_member_id: inviterId, status: ReferralStatus.REWARDED },
    });
    let granted = 0;
    for (const campaign of campaigns) {
      if (qualified < campaign.trigger_count) continue;
      const recipients = campaign.reward_target === CampaignRewardTarget.BOTH
        ? [inviterId, referredMemberId]
        : [campaign.reward_target === CampaignRewardTarget.REFERRED ? referredMemberId : inviterId];
      for (const memberId of new Set(recipients)) {
        if (await CampaignEngineService.fulfill(campaign, memberId, CreditLedgerSource.REFERRAL_REWARD)) granted += 1;
      }
    }
    return granted;
  }

  static async processAttendance(tenantId: string, memberId: string) {
    const campaigns = await CampaignEngineService.list(tenantId, CampaignTriggerType.ATTENDANCE, true);
    const attendanceCount = await AppDataSource.getRepository(Attendance).count({
      where: { tenant_id: tenantId, member_id: memberId, result: AttendanceResult.CREDIT_DEDUCTED },
    });
    let granted = 0;
    for (const campaign of campaigns) {
      if (attendanceCount >= campaign.trigger_count &&
          await CampaignEngineService.fulfill(campaign, memberId, CreditLedgerSource.MANUAL_ADJUST)) {
        granted += 1;
      }
    }
    return granted;
  }
}
