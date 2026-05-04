// Bu controller trainer tarafindaki today.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Attendance } from "../../entities/attendance.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { ClassSession, SessionStatus } from "../../entities/class-session.entity";
import { Measurement } from "../../entities/measurement.entity";
import { Package } from "../../entities/package.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { RiskService } from "../../services/risk.service";
import { lessonCategoryLabel } from "../../services/presentation-label.service";
import { resolveMinimumAdvanceHours } from "./booking-helpers";

export class TrainerTodayController {
  // --- GET /api/trainer/today ---
  static async get(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(now);
      const weekDay = weekStart.getDay() || 7;
      weekStart.setDate(weekStart.getDate() - weekDay + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setMilliseconds(-1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      yearStart.setHours(0, 0, 0, 0);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      yearEnd.setHours(23, 59, 59, 999);

      const previousDayStart = new Date(dayStart);
      previousDayStart.setDate(previousDayStart.getDate() - 1);
      const previousDayEnd = new Date(dayStart);
      previousDayEnd.setMilliseconds(-1);
      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      const previousWeekEnd = new Date(weekStart);
      previousWeekEnd.setMilliseconds(-1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousMonthStart.setHours(0, 0, 0, 0);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      previousMonthEnd.setHours(23, 59, 59, 999);
      const previousYearStart = new Date(now.getFullYear() - 1, 0, 1);
      previousYearStart.setHours(0, 0, 0, 0);
      const previousYearEnd = new Date(now.getFullYear() - 1, 11, 31);
      previousYearEnd.setHours(23, 59, 59, 999);
      const monthlySeriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      monthlySeriesStart.setHours(0, 0, 0, 0);
      const yearlySeriesStart = new Date(now.getFullYear() - 4, 0, 1);
      yearlySeriesStart.setHours(0, 0, 0, 0);

      const bookingRepo = AppDataSource.getRepository(Booking);
      const sessionRepo = AppDataSource.getRepository(ClassSession);
      const attendanceRepo = AppDataSource.getRepository(Attendance);
      const measurementRepo = AppDataSource.getRepository(Measurement);
      const trainerIncomeExpression =
        "(a.credits_deducted * COALESCE(p.display_price::numeric, 0) * (CASE WHEN (p.rules->>'trainer_commission_rate') ~ '^[0-9]+(\\\\.[0-9]+)?$' THEN ((p.rules->>'trainer_commission_rate')::numeric / 100) ELSE 0.25 END))";
      const grossIncomeExpression = "(a.credits_deducted * COALESCE(p.display_price::numeric, 0))";
      const getIncomeTotalForRange = (start: Date, end: Date) =>
        attendanceRepo
          .createQueryBuilder("a")
          .leftJoin(UserPackage, "up", "up.id = a.user_package_id AND up.tenant_id = a.tenant_id")
          .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = a.tenant_id")
          .select(
            `COALESCE(SUM(CASE WHEN a.result = :creditResult THEN ${trainerIncomeExpression} ELSE 0 END), 0)`,
            "total"
          )
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :start", { start })
          .andWhere("a.created_at <= :end", { end })
          .setParameter("creditResult", "CREDIT_DEDUCTED")
          .getRawOne<{ total: string }>();
      const getGrossTotalForRange = (start: Date, end: Date) =>
        attendanceRepo
          .createQueryBuilder("a")
          .leftJoin(UserPackage, "up", "up.id = a.user_package_id AND up.tenant_id = a.tenant_id")
          .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = a.tenant_id")
          .select(
            `COALESCE(SUM(CASE WHEN a.result = :creditResult THEN ${grossIncomeExpression} ELSE 0 END), 0)`,
            "total"
          )
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :start", { start })
          .andWhere("a.created_at <= :end", { end })
          .setParameter("creditResult", "CREDIT_DEDUCTED")
          .getRawOne<{ total: string }>();
      const getCreditedLessonsForRange = (start: Date, end: Date) =>
        attendanceRepo
          .createQueryBuilder("a")
          .select("COALESCE(SUM(CASE WHEN a.result = :creditResult THEN a.credits_deducted ELSE 0 END), 0)", "total")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :start", { start })
          .andWhere("a.created_at <= :end", { end })
          .setParameter("creditResult", "CREDIT_DEDUCTED")
          .getRawOne<{ total: string }>();
      const getMonthlySeries = (start: Date, end: Date) =>
        attendanceRepo
          .createQueryBuilder("a")
          .leftJoin(UserPackage, "up", "up.id = a.user_package_id AND up.tenant_id = a.tenant_id")
          .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = a.tenant_id")
          .select("TO_CHAR(DATE_TRUNC('month', a.created_at), 'YYYY-MM')", "bucket")
          .addSelect(
            `COALESCE(SUM(CASE WHEN a.result = :creditResult THEN ${trainerIncomeExpression} ELSE 0 END), 0)`,
            "total"
          )
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :start", { start })
          .andWhere("a.created_at <= :end", { end })
          .setParameter("creditResult", "CREDIT_DEDUCTED")
          .groupBy("DATE_TRUNC('month', a.created_at)")
          .orderBy("DATE_TRUNC('month', a.created_at)", "ASC")
          .getRawMany<{ bucket: string; total: string }>();
      const getYearlySeries = (start: Date, end: Date) =>
        attendanceRepo
          .createQueryBuilder("a")
          .leftJoin(UserPackage, "up", "up.id = a.user_package_id AND up.tenant_id = a.tenant_id")
          .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = a.tenant_id")
          .select("TO_CHAR(DATE_TRUNC('year', a.created_at), 'YYYY')", "bucket")
          .addSelect(
            `COALESCE(SUM(CASE WHEN a.result = :creditResult THEN ${trainerIncomeExpression} ELSE 0 END), 0)`,
            "total"
          )
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :start", { start })
          .andWhere("a.created_at <= :end", { end })
          .setParameter("creditResult", "CREDIT_DEDUCTED")
          .groupBy("DATE_TRUNC('year', a.created_at)")
          .orderBy("DATE_TRUNC('year', a.created_at)", "ASC")
          .getRawMany<{ bucket: string; total: string }>();

      const [
        todayBookings,
        todaySessions,
        weeklySessionsCount,
        todayCheckins,
        scopedMembersFromBookings,
        scopedMembersFromAttendance,
        scopedMembersFromMeasurements,
        profile,
        dayIncomeRaw,
        weekIncomeRaw,
        monthIncomeRaw,
        monthGrossRaw,
        monthCreditedLessonsRaw,
        previousDayIncomeRaw,
        previousWeekIncomeRaw,
        previousMonthIncomeRaw,
        yearIncomeRaw,
        previousYearIncomeRaw,
        monthlySeriesRaw,
        yearlySeriesRaw,
      ] = await Promise.all([
        bookingRepo
          .createQueryBuilder("b")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.trainer_id = :trainerId", { trainerId })
          .andWhere("b.starts_at >= :dayStart", { dayStart })
          .andWhere("b.starts_at <= :dayEnd", { dayEnd })
          .orderBy("b.starts_at", "ASC")
          .getMany(),
        sessionRepo
          .createQueryBuilder("s")
          .where("s.tenant_id = :tenantId", { tenantId })
          .andWhere("s.trainer_id = :trainerId", { trainerId })
          .andWhere("s.starts_at >= :dayStart", { dayStart })
          .andWhere("s.starts_at <= :dayEnd", { dayEnd })
          .orderBy("s.starts_at", "ASC")
          .getMany(),
        sessionRepo
          .createQueryBuilder("s")
          .where("s.tenant_id = :tenantId", { tenantId })
          .andWhere("s.trainer_id = :trainerId", { trainerId })
          .andWhere("s.starts_at >= :weekStart", { weekStart })
          .andWhere("s.starts_at <= :weekEnd", { weekEnd })
          .andWhere("s.status IN (:...statuses)", {
            statuses: [SessionStatus.SCHEDULED, SessionStatus.COMPLETED],
          })
          .getCount(),
        attendanceRepo
          .createQueryBuilder("a")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :dayStart", { dayStart })
          .andWhere("a.created_at <= :dayEnd", { dayEnd })
          .orderBy("a.created_at", "DESC")
          .getMany(),
        bookingRepo
          .createQueryBuilder("b")
          .select("DISTINCT b.member_id", "member_id")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
        attendanceRepo
          .createQueryBuilder("a")
          .select("DISTINCT a.member_id", "member_id")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
        measurementRepo
          .createQueryBuilder("m")
          .select("DISTINCT m.member_id", "member_id")
          .where("m.tenant_id = :tenantId", { tenantId })
          .andWhere("m.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
        AppDataSource.getRepository(SalonProfile).findOne({
          where: { tenant_id: tenantId },
          order: { updated_at: "DESC", created_at: "DESC" },
          select: ["id", "business_hours", "location", "updated_at", "created_at"],
        }),
        getIncomeTotalForRange(dayStart, dayEnd),
        getIncomeTotalForRange(weekStart, weekEnd),
        getIncomeTotalForRange(monthStart, monthEnd),
        getGrossTotalForRange(monthStart, monthEnd),
        getCreditedLessonsForRange(monthStart, monthEnd),
        getIncomeTotalForRange(previousDayStart, previousDayEnd),
        getIncomeTotalForRange(previousWeekStart, previousWeekEnd),
        getIncomeTotalForRange(previousMonthStart, previousMonthEnd),
        getIncomeTotalForRange(yearStart, yearEnd),
        getIncomeTotalForRange(previousYearStart, previousYearEnd),
        getMonthlySeries(monthlySeriesStart, monthEnd),
        getYearlySeries(yearlySeriesStart, yearEnd),
      ]);

      const scopedMemberIds = Array.from(
        new Set<string>([
          ...scopedMembersFromBookings.map((row) => row.member_id),
          ...scopedMembersFromAttendance.map((row) => row.member_id),
          ...scopedMembersFromMeasurements.map((row) => row.member_id),
        ])
      );

      const riskSummary = scopedMemberIds.length
        ? await RiskService.listRiskMembers({
            tenantId,
            memberIds: scopedMemberIds,
            memberActivity: "ACTIVE",
            riskSegment: "AT_RISK",
            limit: 10,
          })
        : { data: [], total: 0, limit: 0 };

      const dayTotal = Number(dayIncomeRaw?.total || 0);
      const weekTotal = Number(weekIncomeRaw?.total || 0);
      const monthTotal = Number(monthIncomeRaw?.total || 0);
      const yearTotal = Number(yearIncomeRaw?.total || 0);
      const previousDayTotal = Number(previousDayIncomeRaw?.total || 0);
      const previousWeekTotal = Number(previousWeekIncomeRaw?.total || 0);
      const previousMonthTotal = Number(previousMonthIncomeRaw?.total || 0);
      const previousYearTotal = Number(previousYearIncomeRaw?.total || 0);
      const monthGross = Number(monthGrossRaw?.total || 0);
      const monthTrainerIncome = Number(monthIncomeRaw?.total || 0);
      const monthCommissionRate = monthGross > 0 ? (monthTrainerIncome / monthGross) * 100 : 25;
      const buildTrend = (key: "day" | "week" | "month" | "year", label: string, current: number, previous: number) => ({
        key,
        label,
        current: Number(current.toFixed(2)),
        previous: Number(previous.toFixed(2)),
        delta: Number((current - previous).toFixed(2)),
        delta_percent: previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : current > 0 ? 100 : 0,
      });
      const comparison = {
        day: buildTrend("day", "Gün", dayTotal, previousDayTotal),
        week: buildTrend("week", "Hafta", weekTotal, previousWeekTotal),
        month: buildTrend("month", "Ay", monthTotal, previousMonthTotal),
        year: buildTrend("year", "Yıl", yearTotal, previousYearTotal),
      };
      const monthlySeriesMap = new Map(monthlySeriesRaw.map((row) => [row.bucket, Number(row.total || 0)]));
      const monthlySeries = Array.from({ length: 12 }, (_, index) => {
        const bucketDate = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
        const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
        return {
          key,
          label: key,
          total: Number((monthlySeriesMap.get(key) || 0).toFixed(2)),
        };
      });
      const yearlySeriesMap = new Map(yearlySeriesRaw.map((row) => [row.bucket, Number(row.total || 0)]));
      const yearlySeries = Array.from({ length: 5 }, (_, index) => {
        const year = String(now.getFullYear() - 4 + index);
        return {
          key: year,
          label: year,
          total: Number((yearlySeriesMap.get(year) || 0).toFixed(2)),
        };
      });

      const summary = {
        booking_total: todayBookings.length,
        pending_bookings: todayBookings.filter((b) => b.status === BookingStatus.PENDING).length,
        approved_bookings: todayBookings.filter((b) => b.status === BookingStatus.APPROVED).length,
        session_total: todaySessions.length,
        weekly_session_total: weeklySessionsCount,
        member_total: scopedMemberIds.length,
        scheduled_sessions: todaySessions.filter((s) => s.status === SessionStatus.SCHEDULED).length,
        completed_sessions: todaySessions.filter((s) => s.status === SessionStatus.COMPLETED).length,
        checkin_total: todayCheckins.length,
        deducted_credits_total: todayCheckins.reduce((sum, row) => sum + (row.credits_deducted || 0), 0),
      };

      const memberIds = Array.from(
        new Set([
          ...todayBookings.map((row) => row.member_id).filter(Boolean),
          ...todayCheckins.map((row) => row.member_id).filter(Boolean),
        ])
      );
      const members = memberIds.length
        ? await AppDataSource.getRepository(User).find({
            where: memberIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.MEMBER })),
            select: ["id", "first_name", "last_name"],
          })
        : [];
      const memberMap = new Map(members.map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()]));
      const sessionMap = new Map(todaySessions.map((row) => [row.id, row]));

      return res.json({
        data: {
          date: dayStart.toISOString(),
          summary,
          risk: {
            at_risk_count: riskSummary.total,
            preview: riskSummary.data,
          },
          bookings: todayBookings.map((row) => ({
            ...row,
            member_full_name: memberMap.get(row.member_id) ?? null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
            lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
            lesson_category_label: lessonCategoryLabel(
              row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
            ),
          })),
          sessions: todaySessions,
          calendar: {
            business_hours: profile?.business_hours ?? null,
            booking_policy: {
              min_hours_before_start: resolveMinimumAdvanceHours(
                profile?.location?.campaigns?.cancellation_policy?.min_hours_before_start,
                3
              ),
            },
          },
          earnings: {
            day_total: Number(dayTotal.toFixed(2)),
            week_total: Number(weekTotal.toFixed(2)),
            month_total: Number(monthTotal.toFixed(2)),
            year_total: Number(yearTotal.toFixed(2)),
            month_gross_total: Number(monthGross.toFixed(2)),
            month_trainer_income: Number(monthTrainerIncome.toFixed(2)),
            month_commission_rate: Number(monthCommissionRate.toFixed(2)),
            month_credited_lessons: Number(monthCreditedLessonsRaw?.total || 0),
            comparison,
            monthly_series: monthlySeries,
            yearly_series: yearlySeries,
          },
          checkins: todayCheckins.map((row) => ({
            ...row,
            member_full_name: memberMap.get(row.member_id) ?? null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
            lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
            lesson_category_label: lessonCategoryLabel(
              row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
            ),
          })),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer today get error:", error);
      throw new AppError("TRAINER_TODAY_GET_ERROR", 500, "Bugun ozeti getirilemedi");
    }
  }
}
