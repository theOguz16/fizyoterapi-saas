// Bu controller admin tarafindaki payments.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Booking, BookingPaymentStatus } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { Package } from "../../entities/package.entity";
import { User } from "../../entities/user.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { normalizePaymentNote, resolveBookingPaymentStatus } from "./payment-helpers";

export class AdminPaymentsController {
  // --- GET /api/admin/payments/requests ---
  static async listRequests(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const paymentStatus = resolveBookingPaymentStatus(req.query.payment_status);

      const rows = await AppDataSource.getRepository(Booking).find({
        where: { tenant_id: tenantId, payment_status: paymentStatus },
        order: { payment_requested_at: "ASC" },
      });

      const memberIds = Array.from(new Set(rows.map((row) => row.member_id).filter(Boolean)));
      const trainerIds = Array.from(new Set(rows.map((row) => row.trainer_id).filter(Boolean)));
      const sessionIds = Array.from(new Set(rows.map((row) => row.session_id).filter(Boolean)));

      const [members, trainers, sessions] = await Promise.all([
        memberIds.length
          ? AppDataSource.getRepository(User).find({
              where: memberIds.map((id) => ({ tenant_id: tenantId, id })),
              select: ["id", "first_name", "last_name", "email"],
            })
          : Promise.resolve([]),
        trainerIds.length
          ? AppDataSource.getRepository(User).find({
              where: trainerIds.map((id) => ({ tenant_id: tenantId, id })),
              select: ["id", "first_name", "last_name", "email"],
            })
          : Promise.resolve([]),
        sessionIds.length
          ? AppDataSource.getRepository(ClassSession).find({
              where: sessionIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
              select: ["id", "title", "type", "lesson_category", "related_package_id"],
            })
          : Promise.resolve([]),
      ]);

      const packageIds = Array.from(
        new Set(sessions.map((row) => row.related_package_id).filter((value): value is string => Boolean(value)))
      );
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
            select: ["id", "title", "display_price", "type"],
          })
        : [];

      const memberMap = new Map(
        members.map((row) => [
          row.id,
          {
            full_name: `${row.first_name} ${row.last_name}`.trim(),
            email: row.email,
          },
        ])
      );
      const trainerMap = new Map(
        trainers.map((row) => [
          row.id,
          {
            full_name: `${row.first_name} ${row.last_name}`.trim(),
            email: row.email,
          },
        ])
      );
      const sessionMap = new Map(sessions.map((row) => [row.id, row]));
      const packageMap = new Map(packages.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => {
          const session = row.session_id ? sessionMap.get(String(row.session_id)) : undefined;
          const relatedPackage =
            session?.related_package_id ? packageMap.get(String(session.related_package_id)) : undefined;
          return {
            ...row,
            member_full_name: memberMap.get(row.member_id)?.full_name ?? null,
            member_email: memberMap.get(row.member_id)?.email ?? null,
            trainer_full_name: trainerMap.get(row.trainer_id)?.full_name ?? null,
            trainer_email: trainerMap.get(row.trainer_id)?.email ?? null,
            session_title: session?.title ?? null,
            session_type: session?.type ?? null,
            lesson_category: session?.lesson_category ?? null,
            package_id: relatedPackage?.id ?? null,
            package_title: relatedPackage?.title ?? null,
            package_type: relatedPackage?.type ?? null,
            package_display_price: relatedPackage?.display_price ?? null,
          };
        }),
        filters: {
          payment_status: paymentStatus,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin payment requests list error:", error);
      throw new AppError("ADMIN_PAYMENTS_LIST_ERROR", 500, "Odeme talepleri getirilemedi");
    }
  }

  // --- PATCH /api/admin/payments/requests/:bookingId/approve ---
  static async approveRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const adminId = req.auth?.sub;
      const bookingId = String(req.params.bookingId ?? "");
      if (!tenantId || !adminId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { id: bookingId, tenant_id: tenantId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadi");
      }

      booking.payment_status = BookingPaymentStatus.APPROVED;
      booking.payment_approved_at = new Date();
      booking.payment_approved_by_admin_id = adminId;
      booking.payment_note = normalizePaymentNote(req.body?.payment_note, booking.payment_note);
      await bookingRepo.save(booking);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_PAYMENT_APPROVED",
        action: "ADMIN_PAYMENT_APPROVED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "booking",
        target_id: booking.id,
        metadata: { payment_status: booking.payment_status, member_id: booking.member_id, trainer_id: booking.trainer_id },
      });

      return res.json({ data: booking });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin payment approve error:", error);
      throw new AppError("ADMIN_PAYMENT_APPROVE_ERROR", 500, "Odeme talebi onaylanamadi");
    }
  }

  // --- PATCH /api/admin/payments/requests/:bookingId/reject ---
  static async rejectRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const bookingId = String(req.params.bookingId ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { id: bookingId, tenant_id: tenantId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadi");
      }

      booking.payment_status = BookingPaymentStatus.REJECTED;
      booking.payment_approved_at = undefined;
      booking.payment_approved_by_admin_id = undefined;
      booking.payment_note = normalizePaymentNote(req.body?.payment_note, booking.payment_note);
      await bookingRepo.save(booking);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_PAYMENT_REJECTED",
        action: "ADMIN_PAYMENT_REJECTED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "booking",
        target_id: booking.id,
        metadata: { payment_status: booking.payment_status, member_id: booking.member_id, trainer_id: booking.trainer_id },
      });

      return res.json({ data: booking });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin payment reject error:", error);
      throw new AppError("ADMIN_PAYMENT_REJECT_ERROR", 500, "Odeme talebi reddedilemedi");
    }
  }
}
