// Bu servis modulu backend tarafinda referral automation.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { Referral, ReferralStatus } from "../entities/referral.entity";
import { ReferralReward } from "../entities/referral-reward.entity";
import { User, UserRole } from "../entities/user.entity";
import { CampaignEngineService } from "./campaign-engine.service";

export class ReferralAutomationService {
  private static normalizePhone(raw: string | null | undefined) {
    return String(raw ?? "").replace(/\D/g, "");
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

    const grantedCampaigns = await CampaignEngineService.processReferral(tenantId, inviter.id, member.id);

    return {
      processed: true,
      reason: existingReward ? ("ALREADY_REWARDED" as const) : ("REWARDED" as const),
      referralId: referral.id,
      inviterId: inviter.id,
      grantedCampaigns,
    };
  }
}
