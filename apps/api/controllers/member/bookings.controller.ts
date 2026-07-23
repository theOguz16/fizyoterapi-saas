// Bu controller member tarafindaki bookings.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Booking, BookingCheckinStatus, BookingStatus } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { User, UserRole } from "../../entities/user.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { lessonCategoryLabel, packageDisplayName } from "../../services/presentation-label.service";
import { MobileNotificationService } from "../../services/mobile-notification.service";
import { AuditLogService } from "../../services/audit-log.service";
import { UserPackage } from "../../entities/user-package.entity";
import { Tenant } from "../../entities/tenant.entity";

export class MemberBookingsController {
  private static async logBookingAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      booking: Booking;
      oldState?: Record<string, unknown> | null;
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
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "booking",
      target_id: input.booking.id,
      metadata: {
        booking_id: input.booking.id,
        member_id: input.booking.member_id,
        trainer_id: input.booking.trainer_id,
        status: input.booking.status,
        old_state: input.oldState ?? null,
      },
    });
  }

  private static resolveCancellationPolicy(raw: unknown) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { minHoursBeforeStart: 3, refundPolicy: "NO_REFUND" };
    }
    const source = raw as Record<string, unknown>;
    const minHours = Math.max(1, Math.floor(Number(source.min_hours_before_start) || 3));
    const refundPolicy = String(source.refund_policy ?? "NO_REFUND");
    return { minHoursBeforeStart: minHours, refundPolicy };
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const status = req.query.status ? String(req.query.status) : undefined;
      const where: {
        tenant_id: string;
        member_id: string;
        status?: BookingStatus;
      } = {
        tenant_id: tenantId,
        member_id: memberId,
      };
      if (status && Object.values(BookingStatus).includes(status as BookingStatus)) {
        where.status = status as BookingStatus;
      }

      const rows = await AppDataSource.getRepository(Booking).find({
        where,
        order: { starts_at: "DESC" },
      });

      const trainerIds = Array.from(new Set(rows.map((row) => row.trainer_id).filter(Boolean)));
      const sessionIds = Array.from(new Set(rows.map((row) => row.session_id).filter(Boolean)));
      const [trainers, sessions] = await Promise.all([
        trainerIds.length
          ? AppDataSource.getRepository(User).find({
              where: trainerIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.TRAINER })),
              select: ["id", "first_name", "last_name"],
            })
          : Promise.resolve([]),
        sessionIds.length
          ? AppDataSource.getRepository(ClassSession).find({
              where: sessionIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
              select: ["id", "title", "type", "lesson_category"],
            })
          : Promise.resolve([]),
      ]);
      const trainerMap = new Map(trainers.map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()]));
      const sessionMap = new Map(sessions.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => {
          const meta = (row.meta as Record<string, any> | undefined) ?? {};
          const isDuo = Boolean(meta.is_duo || meta.duo);
          return {
            ...row,
            package_name: packageDisplayName(meta.package_title),
            trainer_full_name: trainerMap.get(row.trainer_id) ?? null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : isDuo ? "Duo ders" : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : isDuo ? "DUO" : null,
            lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
            lesson_category_label: isDuo
              ? "İkili ders"
              : lessonCategoryLabel(
                  row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
                ),
            is_duo: isDuo,
            duo_partner_name: meta.duo?.partner_name || null,
            duo_partner_contact: meta.duo?.partner_contact || null,
            duo_status: meta.duo?.status || null,
          };
        }),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member bookings list error:", error);
      throw new AppError("MEMBER_BOOKINGS_LIST_ERROR", 500, "Randevular listelenemedi");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const booking = await AppDataSource.getRepository(Booking).findOne({
        where: { id: bookingId, tenant_id: tenantId, member_id: memberId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Randevu bulunamadi");
      }
      const [profile, trainer, tenant, session] = await Promise.all([
        AppDataSource.getRepository(SalonProfile).findOne({
          where: { tenant_id: tenantId },
          order: { created_at: "DESC" },
          select: ["id", "location"],
        }),
        AppDataSource.getRepository(User).findOne({
          where: { tenant_id: tenantId, id: booking.trainer_id, role: UserRole.TRAINER },
          select: ["id", "first_name", "last_name"],
        }),
        AppDataSource.getRepository(Tenant).findOne({
          where: { id: tenantId },
          select: ["id", "name"],
        }),
        booking.session_id
          ? AppDataSource.getRepository(ClassSession).findOne({
              where: { tenant_id: tenantId, id: String(booking.session_id) },
              select: ["id", "title", "type", "lesson_category"],
            })
          : Promise.resolve(null),
      ]);
      const campaigns =
        profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? (profile.location as Record<string, unknown>).campaigns
          : undefined;
      const rawPolicy =
        campaigns && typeof campaigns === "object" && !Array.isArray(campaigns)
          ? (campaigns as Record<string, unknown>).cancellation_policy
          : undefined;
      const policy = MemberBookingsController.resolveCancellationPolicy(rawPolicy);
      const bookingMeta =
        booking.meta && typeof booking.meta === "object"
          ? booking.meta as Record<string, unknown>
          : {};
      const trainerFullName = trainer
        ? `${trainer.first_name} ${trainer.last_name}`.trim()
        : null;
      const packageTitle = String(bookingMeta.package_title || "").trim() || null;

      return res.json({
        data: {
          ...booking,
          trainer_full_name: trainerFullName,
          tenant_name: tenant?.name || null,
          salon_name: tenant?.name || null,
          package_title: packageTitle,
          package_name: packageDisplayName(packageTitle),
          session_title: session?.title || null,
          session_type: session?.type || null,
          lesson_category: session?.lesson_category || null,
          lesson_category_label: lessonCategoryLabel(session?.lesson_category || null),
          cancellation_policy: {
            min_hours_before_start: policy.minHoursBeforeStart,
            refund_policy: policy.refundPolicy,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member booking getById error:", error);
      throw new AppError("MEMBER_BOOKING_GET_ERROR", 500, "Randevu getirilemedi");
    }
  }

  // --- PATCH /api/member/bookings/:id/cancel ---
  static async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const bookingId = String(req.params.id ?? "").trim();
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      if (!bookingId) {
        throw new AppError("VALIDATION_ERROR", 400, "Randevu kimliği zorunludur");
      }

      const confirmLateCancellation = req.body?.confirm_late_cancellation === true;
      const result = await AppDataSource.transaction(async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const booking = await bookingRepo.findOne({
          where: { id: bookingId, tenant_id: tenantId, member_id: memberId },
          lock: { mode: "pessimistic_write" },
        });
        if (!booking) throw new AppError("BOOKING_NOT_FOUND", 404, "Randevu bulunamadi");
        if (booking.status === BookingStatus.CANCELED) {
          return {
            booking,
            oldState: { status: booking.status },
            idempotent: true,
            isLate: Boolean((booking.meta as Record<string, any> | undefined)?.cancellation?.late),
            creditsDeducted: Number(booking.credits_charged || 0),
            cancellationHours: 3,
          };
        }

        const profile = await manager.getRepository(SalonProfile).findOne({
          where: { tenant_id: tenantId },
          order: { created_at: "DESC" },
          select: ["id", "location"],
        });
        const campaigns =
          profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
            ? (profile.location as Record<string, unknown>).campaigns
            : undefined;
        const cancellationPolicyRaw =
          campaigns && typeof campaigns === "object" && !Array.isArray(campaigns)
            ? (campaigns as Record<string, unknown>).cancellation_policy
            : undefined;
        const cancellationPolicy = MemberBookingsController.resolveCancellationPolicy(cancellationPolicyRaw);
        const now = new Date();
        const minAllowedMs = cancellationPolicy.minHoursBeforeStart * 60 * 60 * 1000;
        const isLate = booking.starts_at.getTime() - now.getTime() < minAllowedMs;
        if (isLate && !confirmLateCancellation) {
          throw new AppError(
            "LATE_CANCELLATION_CONFIRMATION_REQUIRED",
            409,
            `Derse ${cancellationPolicy.minHoursBeforeStart} saatten az kaldı. Onaylarsanız bir ders hakkınız kullanılmış sayılır.`
          );
        }

        const oldState = { status: booking.status, credits_charged: booking.credits_charged };
        let creditsDeducted = 0;
        let userPackageId: string | null = null;
        if (isLate && Number(booking.credits_charged || 0) === 0) {
          const meta = booking.meta && typeof booking.meta === "object" ? booking.meta as Record<string, any> : {};
          const packageId = String(meta.package_id || "").trim();
          const explicitUserPackageId = String(meta.user_package_id || booking.checked_in_user_package_id || "").trim();
          const packageQuery = manager.getRepository(UserPackage)
            .createQueryBuilder("userPackage")
            .setLock("pessimistic_write")
            .where("userPackage.tenant_id = :tenantId", { tenantId })
            .andWhere("userPackage.user_id = :memberId", { memberId })
            .andWhere("userPackage.is_active = true")
            .andWhere("userPackage.remaining_credits > 0");
          if (explicitUserPackageId) {
            packageQuery.andWhere("userPackage.id = :userPackageId", { userPackageId: explicitUserPackageId });
          } else if (packageId) {
            packageQuery.andWhere("userPackage.package_id = :packageId", { packageId });
          }
          const userPackage = await packageQuery
            .orderBy("userPackage.expires_at", "ASC", "NULLS LAST")
            .addOrderBy("userPackage.created_at", "ASC")
            .getOne();
          if (!userPackage) {
            throw new AppError("PACKAGE_CREDIT_NOT_AVAILABLE", 409, "Geç iptal için kullanılabilir paket hakkı bulunamadı");
          }
          userPackage.remaining_credits -= 1;
          await manager.getRepository(UserPackage).save(userPackage);
          userPackageId = userPackage.id;
          creditsDeducted = 1;
          booking.credits_charged = 1;
          booking.checked_in_user_package_id = userPackage.id;
        }

        booking.status = BookingStatus.CANCELED;
        booking.checkin_status = BookingCheckinStatus.CANCELED;
        booking.meta = {
          ...(booking.meta || {}),
          cancellation: {
            canceled_by: "MEMBER",
            canceled_at: now.toISOString(),
            late: isLate,
            confirmed_credit_charge: isLate,
            credits_deducted: creditsDeducted,
            user_package_id: userPackageId,
            refund: false,
            credit_preserved: !isLate,
            refund_policy: isLate ? cancellationPolicy.refundPolicy : "CREDIT_PRESERVED",
            note: isLate
              ? "Üye geç iptal uyarısını onayladı; bir ders hakkı kullanıldı."
              : "Üye süre sınırından önce iptal etti; ders hakkı korundu.",
          },
        };
        await bookingRepo.save(booking);
        return {
          booking,
          oldState,
          idempotent: false,
          isLate,
          creditsDeducted,
          cancellationHours: cancellationPolicy.minHoursBeforeStart,
        };
      });

      if (result.idempotent) {
        await MemberBookingsController.logBookingAudit(req, {
          eventType: "MEMBER_BOOKING_CANCEL_SKIPPED",
          booking: result.booking,
          oldState: result.oldState,
        });
        return res.json({ data: result.booking, message: "Randevu zaten iptal edilmiş." });
      }

      const admins = await AppDataSource.getRepository(User).find({
        where: { tenant_id: tenantId, role: UserRole.ADMIN, is_active: true },
        select: ["id"],
      });
      const notificationBody = result.isLate
        ? "Danışan geç iptali onayladı; bir paket hakkı kullanıldı."
        : "Danışan randevuyu süre sınırından önce iptal etti; paket hakkı korundu.";
      await Promise.allSettled([
        MobileNotificationService.queuePush({
          tenantId,
          userId: memberId,
          roleScope: "MEMBER",
          type: result.isLate ? "BOOKING_CANCELED_LATE" : "BOOKING_CANCELED_EARLY",
          title: "Randevu iptal edildi",
          body: result.isLate
            ? "Geç iptal onaylandı ve bir ders hakkın kullanıldı."
            : "Randevun iptal edildi ve ders hakkın korundu.",
          deepLink: "/(member)/bookings",
          meta: { booking_id: result.booking.id, credits_deducted: result.creditsDeducted },
        }),
        MobileNotificationService.queuePush({
          tenantId,
          userId: result.booking.trainer_id,
          roleScope: "TRAINER",
          type: result.isLate ? "BOOKING_CANCELED_LATE" : "BOOKING_CANCELED_EARLY",
          title: "Randevu iptali bildirimi",
          body: notificationBody,
          deepLink: "/(trainer)/bookings",
          meta: { booking_id: result.booking.id, member_id: memberId, credits_deducted: result.creditsDeducted },
        }),
        ...admins.map((admin) =>
          MobileNotificationService.queuePush({
            tenantId,
            userId: admin.id,
            roleScope: "ADMIN" as const,
            type: result.isLate ? "BOOKING_CANCELED_LATE" : "BOOKING_CANCELED_EARLY",
            title: "Danışan randevu iptali",
            body: notificationBody,
            deepLink: "/(admin)/calendar",
            meta: { booking_id: result.booking.id, member_id: memberId, credits_deducted: result.creditsDeducted },
          })
        ),
      ]);
      await MemberBookingsController.logBookingAudit(req, {
        eventType: result.isLate ? "MEMBER_BOOKING_CANCELED_LATE" : "MEMBER_BOOKING_CANCELED_EARLY",
        booking: result.booking,
        oldState: result.oldState,
      });

      return res.json({
        data: result.booking,
        cancellation: {
          late: result.isLate,
          credits_deducted: result.creditsDeducted,
          credit_preserved: !result.isLate,
          min_hours_before_start: result.cancellationHours,
        },
        message: result.isLate
          ? "Randevu iptal edildi ve onayınızla bir ders hakkı kullanıldı."
          : "Randevu iptal edildi; ders hakkınız korundu.",
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member booking cancel error:", error);
      throw new AppError("MEMBER_BOOKING_CANCEL_ERROR", 500, "Randevu iptal edilemedi");
    }
  }
}
