// Bu controller admin tarafindaki invites.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Invite, InviteStatus } from "../../entities/invite.entity";
import { UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";

export class AdminInvitesController {
  private static async logInviteAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      invite: Invite;
      idempotent?: boolean;
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
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "invite",
      target_id: input.invite.id,
      metadata: {
        invite_id: input.invite.id,
        invited_role: input.invite.role,
        email_or_phone: input.invite.email_or_phone,
        status: input.invite.status,
        expires_at: input.invite.expires_at.toISOString(),
        idempotent: Boolean(input.idempotent),
      },
    });
  }

  private static normalizeIdentity(raw: unknown) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value) return "";
    if (value.includes("@")) return value;
    return value.replace(/\D/g, "");
  }

  private static generateToken() {
    return crypto.randomBytes(24).toString("base64url");
  }

  private static hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // --- GET /api/admin/invites ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const statusRaw = String(req.query.status ?? "").toUpperCase();
      const status = Object.values(InviteStatus).includes(statusRaw as InviteStatus)
        ? (statusRaw as InviteStatus)
        : undefined;
      const roleRaw = String(req.query.role ?? "").toUpperCase();
      const role = Object.values(UserRole).includes(roleRaw as UserRole) ? (roleRaw as UserRole) : undefined;

      const qb = AppDataSource.getRepository(Invite)
        .createQueryBuilder("i")
        .where("i.tenant_id = :tenantId", { tenantId })
        .orderBy("i.created_at", "DESC")
        .limit(200);

      if (status) qb.andWhere("i.status = :status", { status });
      if (role) qb.andWhere("i.role = :role", { role });

      const rows = await qb.getMany();
      return res.json({ data: rows });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin invites list error:", error);
      throw new AppError("ADMIN_INVITES_LIST_ERROR", 500, "Davet listesi getirilemedi");
    }
  }

  // --- POST /api/admin/invites ---
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const adminId = req.auth?.sub;
      if (!tenantId || !adminId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const roleRaw = String(req.body?.role ?? "").toUpperCase();
      if (roleRaw !== UserRole.TRAINER && roleRaw !== UserRole.MEMBER) {
        throw new AppError("VALIDATION_ERROR", 400, "role sadece TRAINER veya MEMBER olabilir");
      }
      const role = roleRaw as UserRole;

      const identity = AdminInvitesController.normalizeIdentity(req.body?.email_or_phone);
      if (!identity) {
        throw new AppError("VALIDATION_ERROR", 400, "email_or_phone zorunlu");
      }
      if (!identity.includes("@") && (identity.length < 7 || identity.length > 15)) {
        throw new AppError("VALIDATION_ERROR", 400, "Telefon formati gecersiz");
      }

      const expiresInHoursRaw = Number(req.body?.expires_in_hours ?? 72);
      const expiresInHours = Number.isFinite(expiresInHoursRaw)
        ? Math.min(Math.max(Math.floor(expiresInHoursRaw), 1), 24 * 30)
        : 72;
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      const repo = AppDataSource.getRepository(Invite);
      const existingPending = await repo
        .createQueryBuilder("i")
        .where("i.tenant_id = :tenantId", { tenantId })
        .andWhere("i.email_or_phone = :identity", { identity })
        .andWhere("i.status = :status", { status: InviteStatus.PENDING })
        .andWhere("i.expires_at > :now", { now: new Date() })
        .getOne();

      if (existingPending) {
        throw new AppError("INVITE_ALREADY_PENDING", 409, "Bu kisi icin aktif bir davet zaten var");
      }

      const token = AdminInvitesController.generateToken();
      const tokenHash = AdminInvitesController.hashToken(token);

      const invite = repo.create({
        tenant_id: tenantId,
        role,
        email_or_phone: identity,
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: InviteStatus.PENDING,
        invited_by_admin_id: adminId,
        meta: {
          note: String(req.body?.note ?? "").trim() || undefined,
        },
      });

      await repo.save(invite);

      const appUrl = process.env.ADMIN_WEB_URL || process.env.WEB_URL || "http://localhost:2929";
      const inviteUrl = `${appUrl.replace(/\/$/, "")}/invite/accept?token=${token}`;
      await AdminInvitesController.logInviteAudit(req, {
        eventType: "ADMIN_INVITE_CREATED",
        invite,
      });

      return res.status(201).json({
        data: {
          ...invite,
          invite_url: inviteUrl,
          invite_token: token,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin invites create error:", error);
      throw new AppError("ADMIN_INVITES_CREATE_ERROR", 500, "Davet olusturulamadi");
    }
  }

  // --- PATCH /api/admin/invites/:id/cancel ---
  static async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const inviteId = String(req.params.id ?? "").trim();
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!inviteId) {
        throw new AppError("VALIDATION_ERROR", 400, "id zorunlu");
      }

      const repo = AppDataSource.getRepository(Invite);
      const invite = await repo.findOne({ where: { tenant_id: tenantId, id: inviteId } });
      if (!invite) {
        throw new AppError("INVITE_NOT_FOUND", 404, "Davet bulunamadi");
      }

      if (invite.status !== InviteStatus.PENDING) {
        await AdminInvitesController.logInviteAudit(req, {
          eventType: "ADMIN_INVITE_CANCEL_SKIPPED",
          invite,
          idempotent: true,
        });
        return res.json({ data: invite, idempotent: true });
      }

      invite.status = InviteStatus.CANCELED;
      invite.canceled_at = new Date();
      await repo.save(invite);
      await AdminInvitesController.logInviteAudit(req, {
        eventType: "ADMIN_INVITE_CANCELED",
        invite,
      });
      return res.json({ data: invite, idempotent: false });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin invites cancel error:", error);
      throw new AppError("ADMIN_INVITES_CANCEL_ERROR", 500, "Davet iptal edilemedi");
    }
  }
}
