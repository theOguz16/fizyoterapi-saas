// Bu controller admin tarafindaki qr.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export class AdminQrController {
  private static parseIncomingCode(rawCode: string) {
    const raw = String(rawCode || "").trim();
    const [baseCode] = raw.split("::UP::");
    return String(baseCode || "").trim();
  }

  private static buildClinicQr(slug: string) {
    return `CLN-${slug.toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private static buildTrainerQr() {
    return `TRN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private static buildMemberQr() {
    return `MEM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  // --- POST /api/admin/qr/backfill ---
  static async backfill(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const tenantRepo = AppDataSource.getRepository(Tenant);
      const userRepo = AppDataSource.getRepository(User);
      const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }

      let clinicUpdated = false;
      if (!tenant.qr_code) {
        tenant.qr_code = AdminQrController.buildClinicQr(tenant.slug || "CLINIC");
        await tenantRepo.save(tenant);
        clinicUpdated = true;
      }

      const users = await userRepo.find({
        where: [{ tenant_id: tenantId, role: UserRole.TRAINER }, { tenant_id: tenantId, role: UserRole.MEMBER }],
      });

      let trainerUpdated = 0;
      let memberUpdated = 0;
      for (const user of users) {
        if (user.qr_code) continue;
        if (user.role === UserRole.TRAINER) {
          user.qr_code = AdminQrController.buildTrainerQr();
          trainerUpdated += 1;
        } else if (user.role === UserRole.MEMBER) {
          user.qr_code = AdminQrController.buildMemberQr();
          memberUpdated += 1;
        }
        await userRepo.save(user);
      }

      return res.json({
        data: {
          clinic_updated: clinicUpdated,
          trainer_updated: trainerUpdated,
          member_updated: memberUpdated,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin QR backfill error:", error);
      throw new AppError("ADMIN_QR_BACKFILL_ERROR", 500, "QR backfill islemi basarisiz");
    }
  }

  static async scanSalonEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const adminId = req.auth?.linkedUserId || req.auth?.sub || null;
      const code = AdminQrController.parseIncomingCode(String(req.body?.qr_code ?? req.body?.manual_code ?? ""));
      if (!tenantId || !adminId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      if (!code) {
        throw new AppError("VALIDATION_ERROR", 422, "QR veya manuel kod zorunludur");
      }

      const user = await AppDataSource.getRepository(User)
        .createQueryBuilder("u")
        .where("u.tenant_id = :tenantId", { tenantId })
        .andWhere("u.role IN (:...roles)", { roles: [UserRole.MEMBER, UserRole.TRAINER] })
        .andWhere("(u.qr_code = :code OR u.email = :code OR u.phone = :code OR u.id::text = :code)", { code })
        .getOne();

      if (!user) {
        throw new AppError("USER_NOT_FOUND", 404, "Bu kodla eşleşen kullanıcı bulunamadı");
      }

      if (user.role === UserRole.TRAINER) {
        return res.json({
          data: {
            success: true,
            context: "SALON_ENTRY",
            message: `${user.first_name} ${user.last_name}`.trim() + " için eğitmen kimliği doğrulandı.",
            member_id: user.id,
            member_full_name: `${user.first_name} ${user.last_name}`.trim(),
          },
        });
      }

      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: {
          tenant_id: tenantId,
          user_id: user.id,
          status: SalonMembershipStatus.ACTIVE,
          is_active_context: true,
        },
      });
      if (!membership) {
        throw new AppError("MEMBERSHIP_NOT_ACTIVE", 409, "Üyenin aktif salon üyeliği bulunmuyor");
      }

      const event = AppDataSource.getRepository(NotificationEvent).create({
        tenant_id: tenantId,
        member_id: user.id,
        type: "SALON_ENTRY_SCAN",
        status: NotificationEventStatus.PROCESSED,
        triggered_by_admin_id: adminId,
        processed_at: new Date(),
        payload: {
          source: "ADMIN_ENTRY_SCAN",
          scanned_at: new Date().toISOString(),
          membership_id: membership.id,
        },
      });
      await AppDataSource.getRepository(NotificationEvent).save(event);

      return res.json({
        data: {
          success: true,
          context: "SALON_ENTRY",
          message: `${user.first_name} ${user.last_name}`.trim() + " için salon girişi kaydedildi.",
          membership_id: membership.id,
          member_id: user.id,
          member_full_name: `${user.first_name} ${user.last_name}`.trim(),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin salon entry scan error:", error);
      throw new AppError("ADMIN_QR_SCAN_ERROR", 500, "Salon girisi kaydedilemedi");
    }
  }
}
