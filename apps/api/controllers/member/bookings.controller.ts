// Bu controller member tarafindaki bookings.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { User, UserRole } from "../../entities/user.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { lessonCategoryLabel, packageDisplayName } from "../../services/presentation-label.service";
import { MobileNotificationService } from "../../services/mobile-notification.service";
import { AuditLogService } from "../../services/audit-log.service";

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

      return res.json({ data: booking });
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

      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { id: bookingId, tenant_id: tenantId, member_id: memberId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Randevu bulunamadi");
      }

      if (booking.status === BookingStatus.CANCELED) {
        await MemberBookingsController.logBookingAudit(req, {
          eventType: "MEMBER_BOOKING_CANCEL_SKIPPED",
          booking,
          oldState: { status: booking.status },
        });
        return res.json({ data: booking, message: "Randevu zaten iptal edilmiş." });
      }
      const oldState = { status: booking.status };

      const profile = await AppDataSource.getRepository(SalonProfile).findOne({
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
      const diffMs = booking.starts_at.getTime() - now.getTime();
      const minAllowedMs = cancellationPolicy.minHoursBeforeStart * 60 * 60 * 1000;
      if (diffMs < minAllowedMs) {
        throw new AppError(
          "BOOKING_CANCEL_WINDOW_CLOSED",
          400,
          `İptal işlemi için en az ${cancellationPolicy.minHoursBeforeStart} saat önce işlem yapılmalıdır`
        );
      }

      booking.status = BookingStatus.CANCELED;
      booking.meta = {
        ...(booking.meta || {}),
        cancellation: {
          canceled_by: "MEMBER",
          canceled_at: now.toISOString(),
          refund: false,
          refund_policy: cancellationPolicy.refundPolicy,
          note: "İptal en az 3 saat önceden yapılabilir, ücret iadesi yoktur.",
        },
      };

      await bookingRepo.save(booking);
      await MobileNotificationService.queuePush({
        tenantId,
        userId: memberId,
        roleScope: "MEMBER",
        type: "BOOKING_CANCELED",
        title: "Randevu iptal edildi",
        body: `${booking.starts_at.toLocaleString("tr-TR")} tarihli randevu iptal edildi.`,
        deepLink: "/(member)/bookings",
        meta: {
          booking_id: booking.id,
          refund: false,
        },
      });
      if (booking.trainer_id) {
        await MobileNotificationService.queuePush({
          tenantId,
          userId: booking.trainer_id,
          roleScope: "TRAINER",
          type: "BOOKING_CANCELED",
          title: "Randevu iptali bildirimi",
          body: "Üye randevuyu iptal etti.",
          deepLink: "/(trainer)/bookings",
          meta: {
            booking_id: booking.id,
            member_id: memberId,
          },
        });
      }
      await MemberBookingsController.logBookingAudit(req, {
        eventType: "MEMBER_BOOKING_CANCELED",
        booking,
        oldState,
      });

      return res.json({
        data: booking,
        message: "Randevu iptal edildi. Ücret iadesi uygulanmaz.",
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member booking cancel error:", error);
      throw new AppError("MEMBER_BOOKING_CANCEL_ERROR", 500, "Randevu iptal edilemedi");
    }
  }
}
