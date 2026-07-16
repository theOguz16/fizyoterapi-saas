// Bu servis modulu backend tarafinda referral automation.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { Referral, ReferralStatus } from "../entities/referral.entity";
import { ReferralReward } from "../entities/referral-reward.entity";
import { User, UserRole } from "../entities/user.entity";
import { CreditLedger, CreditLedgerSource } from "../entities/credit-ledger.entity";
import { MemberCreditWalletService } from "./member-credit-wallet.service";
import { SalonProfile } from "../entities/salon-profile.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { MobileNotificationService } from "./mobile-notification.service";

type ReferralCampaign = {
  id: string;
  required_referrals: number;
  reward_type: string;
  reward_value: number;
  reward_label: string;
  is_active: boolean;
};

export class ReferralAutomationService {
  private static isDirectCreditRewardType(rewardType: string) {
    return rewardType === "GROUP_CLASS_CREDIT" || rewardType === "FREE_CLASS";
  }

  private static normalizePhone(raw: string | null | undefined) {
    return String(raw ?? "").replace(/\D/g, "");
  }

  private static normalizeReferralCampaigns(raw: unknown): ReferralCampaign[] {
    const defaults: ReferralCampaign[] = [
      {
        id: "ref-default-2",
        required_referrals: 2,
        reward_type: "GROUP_CLASS_CREDIT",
        reward_value: 1,
        reward_label: "2 kişi getirene 1 grup dersi",
        is_active: true,
      },
    ];

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return defaults;
    }

    const source = raw as Record<string, unknown>;
    const rows = Array.isArray(source.referral_campaigns) ? source.referral_campaigns : defaults;
    return rows
      .map((item, index) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          id: String(row.id ?? "").trim() || `ref-${index + 1}`,
          required_referrals: Math.max(1, Math.floor(Number(row.required_referrals) || 0)),
          reward_type: String(row.reward_type ?? "FREE_CLASS"),
          reward_value: Math.max(0, Number(row.reward_value) || 0),
          reward_label: String(row.reward_label ?? "").trim() || "Ödül",
          is_active: row.is_active === undefined ? true : Boolean(row.is_active),
        };
      })
      .filter((row) => row.is_active)
      .sort((a, b) => a.required_referrals - b.required_referrals);
  }

  private static async getReferralCampaigns(tenantId: string): Promise<ReferralCampaign[]> {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "location"],
    });

    const location =
      profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
        ? (profile.location as Record<string, unknown>)
        : {};
    const campaigns =
      location.campaigns && typeof location.campaigns === "object" && !Array.isArray(location.campaigns)
        ? (location.campaigns as Record<string, unknown>)
        : {};

    return ReferralAutomationService.normalizeReferralCampaigns(campaigns);
  }

  private static async findCandidateReferral(tenantId: string, member: User) {
    const email = String(member.email ?? "").trim().toLowerCase();
    const phone = ReferralAutomationService.normalizePhone(member.phone);

    const identities = [email, phone].filter((v) => v.length > 0);
    if (identities.length === 0) return null;

    const repo = AppDataSource.getRepository(Referral);
    return repo
      .createQueryBuilder("r")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.status IN (:...statuses)", {
        statuses: [ReferralStatus.INVITED, ReferralStatus.CONVERTED, ReferralStatus.REWARDED],
      })
      .andWhere("LOWER(r.invitee_phone_or_email) IN (:...identities)", { identities })
      .orderBy("r.created_at", "DESC")
      .getOne();
  }

  private static async hasTrainerBinding(tenantId: string, memberId: string) {
    const count = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.member_id = :memberId", { memberId })
      .andWhere("b.trainer_id IS NOT NULL")
      .andWhere("b.status IN (:...statuses)", {
        statuses: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
      })
      .getCount();

    return count > 0;
  }

  private static async countQualifiedReferrals(tenantId: string, inviterMemberId: string) {
    return AppDataSource.getRepository(Referral)
      .createQueryBuilder("r")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.inviter_member_id = :inviterMemberId", { inviterMemberId })
      .andWhere("r.status = :status", { status: ReferralStatus.REWARDED })
      .getCount();
  }

  private static async hasCampaignRewardAlready(
    tenantId: string,
    memberId: string,
    campaignId: string,
    milestone: number,
    rewardType: string
  ) {
    if (ReferralAutomationService.isDirectCreditRewardType(rewardType)) {
      const existing = await AppDataSource.getRepository(CreditLedger)
        .createQueryBuilder("cl")
        .where("cl.tenant_id = :tenantId", { tenantId })
        .andWhere("cl.member_id = :memberId", { memberId })
        .andWhere("cl.source = :source", { source: CreditLedgerSource.REFERRAL_REWARD })
        .andWhere("cl.meta ->> 'campaign_id' = :campaignId", { campaignId })
        .andWhere("cl.meta ->> 'milestone' = :milestone", { milestone: String(milestone) })
        .getOne();
      return Boolean(existing);
    }

    const claim = await AppDataSource.getRepository(NotificationEvent)
      .createQueryBuilder("ne")
      .where("ne.tenant_id = :tenantId", { tenantId })
      .andWhere("ne.member_id = :memberId", { memberId })
      .andWhere("ne.type = :type", { type: "CAMPAIGN_REWARD_CLAIM" })
      .andWhere("ne.payload ->> 'campaign_id' = :campaignId", { campaignId })
      .andWhere("ne.payload ->> 'milestone' = :milestone", { milestone: String(milestone) })
      .getOne();

    return Boolean(claim);
  }

  private static async grantCampaignReward(params: {
    tenantId: string;
    inviterId: string;
    campaign: ReferralCampaign;
  }) {
    const { tenantId, inviterId, campaign } = params;
    const amount = Math.max(1, Math.floor(campaign.reward_value || 1));

    if (ReferralAutomationService.isDirectCreditRewardType(campaign.reward_type)) {
      await MemberCreditWalletService.addCredits({
        tenantId,
        memberId: inviterId,
        amount,
        source: CreditLedgerSource.REFERRAL_REWARD,
        referenceType: "REFERRAL_CAMPAIGN",
        referenceId: campaign.id,
        meta: {
          campaign_id: campaign.id,
          milestone: campaign.required_referrals,
          reward_type: campaign.reward_type,
          reward_label: campaign.reward_label,
        },
      });
      await MobileNotificationService.queuePush({
        tenantId,
        userId: inviterId,
        roleScope: "MEMBER",
        type: "CAMPAIGN_REWARD_EARNED",
        title: "Kampanya ödülü kazandın",
        body: campaign.reward_label,
        deepLink: "/(member)/referrals",
        meta: {
          campaign_id: campaign.id,
          reward_type: campaign.reward_type,
          reward_value: amount,
        },
      });
      return;
    }

    await AppDataSource.getRepository(NotificationEvent).save(
      AppDataSource.getRepository(NotificationEvent).create({
        tenant_id: tenantId,
        member_id: inviterId,
        type: "CAMPAIGN_REWARD_CLAIM",
        payload: {
          campaign_id: campaign.id,
          milestone: campaign.required_referrals,
          reward_type: campaign.reward_type,
          reward_value: amount,
          reward_label: campaign.reward_label,
          status: "PENDING_CLAIM",
        },
        status: NotificationEventStatus.PROCESSED,
        processed_at: new Date(),
      })
    );
    await MobileNotificationService.queuePush({
      tenantId,
      userId: inviterId,
      roleScope: "MEMBER",
      type: "CAMPAIGN_REWARD_EARNED",
      title: "Kampanya ödülü hazır",
      body: campaign.reward_label,
      deepLink: "/(member)/referrals",
      meta: {
        campaign_id: campaign.id,
        reward_type: campaign.reward_type,
        reward_value: amount,
      },
    });
  }

  private static async applyReferralCampaignRewards(tenantId: string, inviterId: string) {
    const [campaigns, qualifiedReferrals] = await Promise.all([
      ReferralAutomationService.getReferralCampaigns(tenantId),
      ReferralAutomationService.countQualifiedReferrals(tenantId, inviterId),
    ]);

    let grantedCount = 0;
    for (const campaign of campaigns) {
      if (qualifiedReferrals < campaign.required_referrals) continue;
      const alreadyGranted = await ReferralAutomationService.hasCampaignRewardAlready(
        tenantId,
        inviterId,
        campaign.id,
        campaign.required_referrals,
        campaign.reward_type
      );
      if (alreadyGranted) continue;
      await ReferralAutomationService.grantCampaignReward({ tenantId, inviterId, campaign });
      grantedCount += 1;
    }

    return grantedCount;
  }

  static async processForMember(tenantId: string, memberId: string) {
    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) return { processed: false, reason: "MEMBER_NOT_FOUND" as const };

    const referral = await ReferralAutomationService.findCandidateReferral(tenantId, member);
    if (!referral) return { processed: false, reason: "REFERRAL_NOT_FOUND" as const };

    if (referral.status === ReferralStatus.INVITED) {
      referral.status = ReferralStatus.CONVERTED;
      referral.converted_at = new Date();
      await AppDataSource.getRepository(Referral).save(referral);
    }

    const hasBinding = await ReferralAutomationService.hasTrainerBinding(tenantId, memberId);
    if (!hasBinding) {
      return { processed: true, reason: "CONVERTED_WAITING_BINDING" as const, referralId: referral.id };
    }

    const inviter = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: referral.inviter_member_id, role: UserRole.MEMBER },
    });
    if (!inviter) {
      return { processed: true, reason: "INVITER_NOT_FOUND" as const, referralId: referral.id };
    }

    const rewardRepo = AppDataSource.getRepository(ReferralReward);
    const existingReward = await rewardRepo.findOne({
      where: { tenant_id: tenantId, referral_id: referral.id, member_id: inviter.id },
    });

    if (!existingReward) {
      const reward = rewardRepo.create({
        tenant_id: tenantId,
        referral_id: referral.id,
        member_id: inviter.id,
        credits_granted: 0,
        rule_name: "Davet edilen üye eğitmene bağlandı",
        granted_at: new Date(),
      });
      await rewardRepo.save(reward);
    }

    if (referral.status !== ReferralStatus.REWARDED) {
      referral.status = ReferralStatus.REWARDED;
      await AppDataSource.getRepository(Referral).save(referral);
    }

    const grantedCampaigns = await ReferralAutomationService.applyReferralCampaignRewards(tenantId, inviter.id);

    return {
      processed: true,
      reason: existingReward ? ("ALREADY_REWARDED" as const) : ("REWARDED" as const),
      referralId: referral.id,
      inviterId: inviter.id,
      grantedCampaigns,
    };
  }
}
