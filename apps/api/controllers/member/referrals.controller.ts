// Bu controller member tarafindaki referrals.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Referral, ReferralStatus } from "../../entities/referral.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";

export class MemberReferralsController {
  private static async logReferralAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      row: Referral;
    }
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: input.eventType,
      action: input.eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 201,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "referral",
      target_id: input.row.id,
      metadata: {
        member_id: input.row.inviter_member_id,
        invitee: input.row.invitee_phone_or_email,
        code: input.row.code,
        status: input.row.status,
      },
    });
  }

  private static normalizeInvitee(raw: unknown) {
    return String(raw ?? "").trim().toLowerCase();
  }

  private static async generateCode(tenantId: string) {
    const repo = AppDataSource.getRepository(Referral);
    for (let i = 0; i < 6; i += 1) {
      const code = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const exists = await repo.findOne({ where: { tenant_id: tenantId, code } });
      if (!exists) return code;
    }
    throw new AppError("REFERRAL_CODE_GENERATION_FAILED", 500, "Referral kodu üretilemedi");
  }

  // --- GET /api/member/referrals ---
  static async listMine(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const rows = await AppDataSource.getRepository(Referral).find({
        where: { tenant_id: tenantId, inviter_member_id: memberId },
        order: { created_at: "DESC" },
      });

      return res.json({ data: rows });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member referrals list error:", error);
      throw new AppError("MEMBER_REFERRALS_LIST_ERROR", 500, "Referanslar listelenemedi");
    }
  }

  // --- POST /api/member/referrals ---
  static async createInvite(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const member = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }
      if (!member.is_active) {
        throw new AppError("MEMBER_INACTIVE", 400, "Uye aktif degil");
      }

      const invitee = MemberReferralsController.normalizeInvitee(req.body?.invitee_phone_or_email);
      const inviteeName = String(req.body?.invitee_name ?? "").trim();
      if (!invitee) {
        throw new AppError("VALIDATION_ERROR", 400, "invitee_phone_or_email zorunlu");
      }
      if (invitee.length > 120) {
        throw new AppError("VALIDATION_ERROR", 400, "invitee_phone_or_email cok uzun");
      }
      if (inviteeName.length > 120) {
        throw new AppError("VALIDATION_ERROR", 400, "invitee_name cok uzun");
      }

      const repo = AppDataSource.getRepository(Referral);
      const existing = await repo.findOne({
        where: {
          tenant_id: tenantId,
          inviter_member_id: memberId,
          invitee_phone_or_email: invitee,
        },
        order: { created_at: "DESC" },
      });
      if (existing && existing.status !== ReferralStatus.CANCELED) {
        throw new AppError("REFERRAL_ALREADY_EXISTS", 400, "Bu kisi icin zaten davet var");
      }

      const code = await MemberReferralsController.generateCode(tenantId);
      const row = repo.create({
        tenant_id: tenantId,
        inviter_member_id: memberId,
        invitee_phone_or_email: invitee,
        invitee_name: inviteeName || null,
        code,
        status: ReferralStatus.INVITED,
      });
      await repo.save(row);
      await MemberReferralsController.logReferralAudit(req, {
        eventType: "MEMBER_REFERRAL_CREATED",
        row,
      });

      return res.status(201).json({ data: row });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member referrals create error:", error);
      throw new AppError("MEMBER_REFERRAL_CREATE_ERROR", 500, "Davet olusturulamadi");
    }
  }
}
