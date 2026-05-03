// Bu controller member tarafindaki attendance.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Attendance, AttendanceResult } from "../../entities/attendance.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { Package } from "../../entities/package.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { lessonCategoryLabel, packageDisplayName } from "../../services/presentation-label.service";

export class MemberAttendanceController {
  // --- GET /api/member/attendance/history ---
  static async history(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 50;
      const now = new Date();

      const [rows, upcomingBookings, pastBookings, userPackages] = await Promise.all([
        AppDataSource.getRepository(Attendance).find({
          where: { tenant_id: tenantId, member_id: memberId },
          order: { created_at: "DESC" },
          take: limit,
        }),
        AppDataSource.getRepository(Booking)
          .createQueryBuilder("b")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.member_id = :memberId", { memberId })
          .andWhere("b.starts_at >= :now", { now })
          .andWhere("b.status IN (:...statuses)", {
            statuses: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
          })
          .orderBy("b.starts_at", "ASC")
          .limit(6)
          .getMany(),
        AppDataSource.getRepository(Booking)
          .createQueryBuilder("b")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.member_id = :memberId", { memberId })
          .andWhere("(b.starts_at < :now OR b.status = :canceled)", { now, canceled: BookingStatus.CANCELED })
          .orderBy("b.starts_at", "DESC")
          .limit(10)
          .getMany(),
        AppDataSource.getRepository(UserPackage)
          .createQueryBuilder("up")
          .where("up.tenant_id = :tenantId", { tenantId })
          .andWhere("up.user_id = :memberId", { memberId })
          .andWhere("up.is_active = true")
          .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
          .orderBy("up.created_at", "DESC")
          .getMany(),
      ]);

      const summaryBase = {
        total: rows.length,
        creditDeductedCount: rows.filter((r) => r.result === AttendanceResult.CREDIT_DEDUCTED).length,
        noCreditCount: rows.filter((r) => r.result === AttendanceResult.NO_CREDIT).length,
        packageExpiredCount: rows.filter((r) => r.result === AttendanceResult.PACKAGE_EXPIRED).length,
        userInactiveCount: rows.filter((r) => r.result === AttendanceResult.USER_INACTIVE).length,
        totalCreditsDeducted: rows.reduce((sum, r) => sum + (r.credits_deducted || 0), 0),
      };

      const bookingRows = [...upcomingBookings, ...pastBookings];
      const trainerIds = Array.from(
        new Set([...rows.map((row) => row.trainer_id), ...bookingRows.map((row) => row.trainer_id)].filter(Boolean))
      );
      const sessionIds = Array.from(
        new Set([...rows.map((row) => row.session_id), ...bookingRows.map((row) => row.session_id)].filter(Boolean))
      );
      const packageIdsFromBookings = bookingRows
        .map((row) => String((row.meta as Record<string, unknown> | undefined)?.package_id ?? ""))
        .filter(Boolean);
      const userPackageIdsFromAttendance = Array.from(
        new Set(rows.map((row) => row.user_package_id).filter(Boolean).map((id) => String(id)))
      );
      const historicalUserPackages = userPackageIdsFromAttendance.length
        ? await AppDataSource.getRepository(UserPackage).find({
            where: userPackageIdsFromAttendance.map((id) => ({ tenant_id: tenantId, id })),
            select: ["id", "package_id", "remaining_credits"],
          })
        : [];
      const packageIds = Array.from(
        new Set(
          [...userPackages.map((row) => row.package_id), ...historicalUserPackages.map((row) => row.package_id), ...packageIdsFromBookings].filter(Boolean)
        )
      );
      const userPackageMap = new Map(historicalUserPackages.map((row) => [row.id, row]));

      const [trainers, sessions, packages] = await Promise.all([
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
        packageIds.length
          ? AppDataSource.getRepository(Package).find({
              where: packageIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
              select: ["id", "title", "display_price", "total_credits"],
            })
          : Promise.resolve([]),
      ]);
      const trainerMap = new Map(trainers.map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()]));
      const sessionMap = new Map(sessions.map((row) => [row.id, row]));
      const packageMap = new Map(
        packages.map((row) => [
          row.id,
          {
            title: row.title,
            display_price: row.display_price ?? null,
            total_credits: row.total_credits,
          },
        ])
      );

      const mapBooking = (row: Booking) => {
        const meta = (row.meta as Record<string, unknown> | undefined) ?? {};
        const metaPackageId = String(meta.package_id ?? "");
        const packageInfo = metaPackageId ? packageMap.get(metaPackageId) : null;

        return {
          ...row,
          trainer_full_name: row.trainer_id ? trainerMap.get(row.trainer_id) ?? null : null,
          session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
          session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
          lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
          lesson_category_label: lessonCategoryLabel(
            row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
          ),
          package_title:
            (typeof meta.package_title === "string" && meta.package_title) ||
            (metaPackageId ? packageInfo?.title ?? null : null),
          package_display_price:
            (typeof meta.package_display_price === "string" && meta.package_display_price) ||
            (metaPackageId ? packageInfo?.display_price ?? null : null),
          package_name: packageDisplayName(
            (typeof meta.package_title === "string" && meta.package_title) ||
              (metaPackageId ? packageInfo?.title ?? null : null)
          ),
        };
      };

      const groupAttendanceCount = rows.reduce((count, row) => {
        const lessonCategory = row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category : null;
        return lessonCategory === "GRUP" ? count + 1 : count;
      }, 0);
      const remainingTotalCredits = userPackages.reduce((sum, row) => sum + (row.remaining_credits || 0), 0);
      const summary = {
        ...summaryBase,
        total_attendance_count: rows.length,
        group_attendance_count: groupAttendanceCount,
        remaining_total_credits: remainingTotalCredits,
      };

      return res.json({
        data: rows.map((row) => ({
          ...row,
          trainer_full_name: trainerMap.get(row.trainer_id) ?? null,
          session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
          session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
          lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
          lesson_category_label: lessonCategoryLabel(
            row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
          ),
          package_title: row.user_package_id
            ? packageMap.get(String(userPackageMap.get(String(row.user_package_id))?.package_id ?? ""))?.title ?? null
            : null,
          package_display_price: row.user_package_id
            ? packageMap.get(String(userPackageMap.get(String(row.user_package_id))?.package_id ?? ""))?.display_price ?? null
            : null,
          remaining_credits: row.user_package_id
            ? userPackageMap.get(String(row.user_package_id))?.remaining_credits ?? null
            : null,
          package_name: packageDisplayName(
            row.user_package_id
              ? packageMap.get(String(userPackageMap.get(String(row.user_package_id))?.package_id ?? ""))?.title ?? null
              : null
          ),
        })),
        summary,
        package_balances: userPackages.map((row) => ({
          user_package_id: row.id,
          package_id: row.package_id,
          package_title: packageMap.get(row.package_id)?.title ?? "Paket",
          package_name: packageDisplayName(packageMap.get(row.package_id)?.title ?? "Paket"),
          package_display_price: packageMap.get(row.package_id)?.display_price ?? null,
          total_credits: packageMap.get(row.package_id)?.total_credits ?? null,
          remaining_credits: row.remaining_credits,
          used_credits:
            typeof packageMap.get(row.package_id)?.total_credits === "number"
              ? Math.max(0, (packageMap.get(row.package_id)?.total_credits || 0) - row.remaining_credits)
              : null,
          expires_at: row.expires_at ?? null,
          starts_at: row.starts_at ?? null,
        })),
        upcoming_bookings: upcomingBookings.map((row) => mapBooking(row)),
        past_bookings: pastBookings.map((row) => mapBooking(row)),
        limit,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member attendance history error:", error);
      throw new AppError("MEMBER_ATTENDANCE_HISTORY_ERROR", 500, "Katilim gecmisi getirilemedi");
    }
  }
}
