// Bu controller admin tarafindaki payments.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Booking, BookingPaymentStatus } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { Package } from "../../entities/package.entity";
import { User } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { normalizePaymentNote, resolveBookingPaymentStatus } from "./payment-helpers";

export class AdminPaymentsController {
  private static resolveDateRange(req: AuthenticatedRequest) {
    const now = new Date();
    const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from) : new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz tarih araligi");
    }
    return { from, to };
  }

  private static async buildRevenueRows(req: AuthenticatedRequest) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
    }
    const { from, to } = AdminPaymentsController.resolveDateRange(req);
    const packageId = typeof req.query.package_id === "string" ? req.query.package_id.trim() : "";
    const trainerId = typeof req.query.trainer_id === "string" ? req.query.trainer_id.trim() : "";

    const qb = AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .innerJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = up.tenant_id")
      .leftJoin(User, "u", "u.id = up.user_id AND u.tenant_id = up.tenant_id")
      .select("up.id", "id")
      .addSelect("up.created_at", "created_at")
      .addSelect("up.user_id", "member_id")
      .addSelect("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))", "member_name")
      .addSelect("up.package_id", "package_id")
      .addSelect("p.title", "package_title")
      .addSelect("p.type", "package_type")
      .addSelect("COALESCE(up.purchase_price::numeric, up.latest_package_price::numeric, p.display_price::numeric, 0)", "amount")
      .addSelect("p.total_credits", "credits")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.deleted_at IS NULL")
      .andWhere("up.created_at >= :from AND up.created_at <= :to", { from, to })
      .orderBy("up.created_at", "DESC");

    if (packageId) {
      qb.andWhere("up.package_id = :packageId", { packageId });
    }
    if (trainerId) {
      qb.innerJoin(PackageTrainerAssignment, "pta", "pta.package_id = up.package_id AND pta.tenant_id = up.tenant_id AND pta.is_active = true");
      qb.andWhere("pta.trainer_id = :trainerId", { trainerId });
    }

    return {
      from,
      to,
      rows: await qb.getRawMany<{
        id: string;
        created_at: Date;
        member_id: string;
        member_name: string;
        package_id: string;
        package_title: string;
        package_type: string;
        amount: string;
        credits: string;
      }>(),
    };
  }

  // --- GET /api/admin/payments/revenue/report ---
  static async revenueReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { from, to, rows } = await AdminPaymentsController.buildRevenueRows(req);
      const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const byPackage = new Map<string, { package_id: string; package_title: string; amount: number; count: number }>();
      for (const row of rows) {
        const key = row.package_id || "unknown";
        const current = byPackage.get(key) || { package_id: key, package_title: row.package_title || "Paket", amount: 0, count: 0 };
        current.amount += Number(row.amount || 0);
        current.count += 1;
        byPackage.set(key, current);
      }

      return res.json({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          total_revenue: total,
          sale_count: rows.length,
          average_sale: rows.length ? total / rows.length : 0,
          by_package: Array.from(byPackage.values()).sort((a, b) => b.amount - a.amount),
          rows,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin revenue report error:", error);
      throw new AppError("ADMIN_REVENUE_REPORT_ERROR", 500, "Gelir raporu getirilemedi");
    }
  }

  // --- GET /api/admin/payments/revenue/export.csv ---
  static async revenueExportCsv(req: AuthenticatedRequest, res: Response) {
    try {
      const { rows } = await AdminPaymentsController.buildRevenueRows(req);
      const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const header = ["created_at", "member_name", "package_title", "package_type", "amount", "credits"];
      const body = rows.map((row) =>
        [row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, row.member_name, row.package_title, row.package_type, row.amount, row.credits]
          .map(escapeCsv)
          .join(",")
      );
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", "attachment; filename=\"fizyoflow-revenue.csv\"");
      return res.send([header.join(","), ...body].join("\n"));
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin revenue CSV error:", error);
      throw new AppError("ADMIN_REVENUE_CSV_ERROR", 500, "Gelir raporu disa aktarilamadi");
    }
  }

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
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
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
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
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
