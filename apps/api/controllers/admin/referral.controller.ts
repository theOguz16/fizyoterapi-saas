// Bu controller admin tarafindaki referral.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Referral, ReferralStatus } from "../../entities/referral.entity";
import { ReferralReward } from "../../entities/referral-reward.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { MemberCreditWalletService } from "../../services/member-credit-wallet.service";
import { CreditLedgerSource } from "../../entities/credit-ledger.entity";

export class AdminReferralsController {
  // --- GET /api/admin/referrals ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
      const memberId = req.query.memberId ? String(req.query.memberId).trim() : undefined;
      const limitRaw = req.query.limit ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;

      const qb = AppDataSource.getRepository(Referral)
        .createQueryBuilder("r")
        .where("r.tenant_id = :tenantId", { tenantId })
        .orderBy("r.created_at", "DESC")
        .limit(limit);

      if (status && Object.values(ReferralStatus).includes(status as ReferralStatus)) {
        qb.andWhere("r.status = :status", { status });
      }
      if (memberId) {
        qb.andWhere("r.inviter_member_id = :memberId", { memberId });
      }

      const rows = await qb.getMany();
      return res.json({ data: rows, limit });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin referrals list error:", error);
      throw new AppError("ADMIN_REFERRALS_LIST_ERROR", 500, "Referanslar listelenemedi");
    }
  }

  // --- GET /api/admin/referrals/:id ---
  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const referralId = String(req.params.id ?? "").trim();
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!referralId) {
        throw new AppError("VALIDATION_ERROR", 400, "id zorunlu");
      }

      const referral = await AppDataSource.getRepository(Referral).findOne({
        where: { tenant_id: tenantId, id: referralId },
      });
      if (!referral) {
        throw new AppError("REFERRAL_NOT_FOUND", 404, "Referans kaydi bulunamadi");
      }

      const rewards = await AppDataSource.getRepository(ReferralReward).find({
        where: { tenant_id: tenantId, referral_id: referral.id },
        order: { granted_at: "DESC" },
      });
      return res.json({ data: { referral, rewards } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin referral detail error:", error);
      throw new AppError("ADMIN_REFERRAL_DETAIL_ERROR", 500, "Referans detayi getirilemedi");
    }
  }

  // --- POST /api/admin/referrals/:id/grant-reward ---
  static async grantReward(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const referralId = String(req.params.id ?? "").trim();
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!referralId) {
        throw new AppError("VALIDATION_ERROR", 400, "id zorunlu");
      }

      const creditsRaw = req.body?.credits_granted ?? 1;
      const creditsGranted = Number(creditsRaw);
      if (!Number.isFinite(creditsGranted) || creditsGranted < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "credits_granted gecersiz");
      }
      const ruleNameRaw = String(req.body?.rule_name ?? "").trim();
      const ruleName = ruleNameRaw || "Referral reward";

      const referralRepo = AppDataSource.getRepository(Referral);
      const rewardRepo = AppDataSource.getRepository(ReferralReward);
      const userPackageRepo = AppDataSource.getRepository(UserPackage);

      const referral = await referralRepo.findOne({
        where: { tenant_id: tenantId, id: referralId },
      });
      if (!referral) {
        throw new AppError("REFERRAL_NOT_FOUND", 404, "Referans kaydi bulunamadi");
      }

      const inviter = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: referral.inviter_member_id, role: UserRole.MEMBER },
      });
      if (!inviter) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Davet eden uye bulunamadi");
      }

      const existingReward = await rewardRepo.findOne({
        where: { tenant_id: tenantId, referral_id: referral.id, member_id: inviter.id },
        order: { granted_at: "DESC" },
      });
      if (existingReward) {
        return res.json({
          data: {
            reward: existingReward,
            idempotent: true,
            userPackageUpdated: false,
          },
        });
      }

      if (referral.status === ReferralStatus.CANCELED) {
        throw new AppError("REFERRAL_CANCELED", 400, "Iptal edilmis davete odul verilemez");
      }
      if (referral.status === ReferralStatus.INVITED) {
        referral.status = ReferralStatus.CONVERTED;
        referral.converted_at = referral.converted_at ?? new Date();
      }

      const now = new Date();
      const activeUserPackage = await userPackageRepo.findOne({
        where: { tenant_id: tenantId, user_id: inviter.id, is_active: true },
        order: { created_at: "DESC" },
      });
      const packageUpdated = false;

      const reward = rewardRepo.create({
        tenant_id: tenantId,
        referral_id: referral.id,
        member_id: inviter.id,
        credits_granted: Math.floor(creditsGranted),
        rule_name: ruleName.slice(0, 120),
        granted_at: now,
      });
      await rewardRepo.save(reward);

      await MemberCreditWalletService.addCredits({
        tenantId,
        memberId: inviter.id,
        amount: Math.floor(creditsGranted),
        source: CreditLedgerSource.MANUAL_ADJUST,
        referenceType: "ADMIN_REFERRAL_OVERRIDE",
        referenceId: referral.id,
      });

      referral.status = ReferralStatus.REWARDED;
      await referralRepo.save(referral);

      return res.json({
        data: {
          reward,
          idempotent: false,
          userPackageUpdated: packageUpdated,
          userPackageId: activeUserPackage?.id ?? null,
          rewardModel: "REFERRAL_WALLET",
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin referral grantReward error:", error);
      throw new AppError("ADMIN_REFERRAL_GRANT_REWARD_ERROR", 500, "Referans odulu verilemedi");
    }
  }

  // --- GET /api/admin/referrals/rewards/list ---
  static async listRewards(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const memberId = req.query.memberId ? String(req.query.memberId).trim() : undefined;
      const limitRaw = req.query.limit ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;

      const qb = AppDataSource.getRepository(ReferralReward)
        .createQueryBuilder("rr")
        .where("rr.tenant_id = :tenantId", { tenantId })
        .orderBy("rr.granted_at", "DESC")
        .limit(limit);
      if (memberId) {
        qb.andWhere("rr.member_id = :memberId", { memberId });
      }

      const rows = await qb.getMany();
      return res.json({ data: rows, limit });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin referral rewards list error:", error);
      throw new AppError("ADMIN_REFERRAL_REWARDS_LIST_ERROR", 500, "Referral reward listesi getirilemedi");
    }
  }
}
