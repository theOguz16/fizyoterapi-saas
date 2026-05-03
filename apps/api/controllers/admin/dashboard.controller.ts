// Bu controller admin tarafindaki dashboard.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Lead, LeadStatus } from "../../entities/lead.entity";
import { Package } from "../../entities/package.entity";
import { User, UserRole } from "../../entities/user.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { ClassSession, SessionStatus } from "../../entities/class-session.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { RiskService } from "../../services/risk.service";

export class AdminDashboardController {
  private static async resolveReportTimezone(tenantId: string) {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "location"],
    });

    const location =
      profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
        ? (profile.location as Record<string, unknown>)
        : {};

    const timezone = typeof location.timezone === "string" ? location.timezone.trim() : "";

    return timezone || "Europe/Istanbul";
  }

  private static async buildSummary(tenantId: string) {
    const baseWhere = { tenant_id: tenantId };

    const leadRepo = AppDataSource.getRepository(Lead);
    const packageRepo = AppDataSource.getRepository(Package);
    const userRepo = AppDataSource.getRepository(User);

    const reportTimezone = await AdminDashboardController.resolveReportTimezone(tenantId);

    const saleAmountExpression =
      "COALESCE(up.purchase_price::numeric, up.latest_package_price::numeric, p.display_price::numeric, 0)";

    const creditsExpression = "COALESCE(p.total_credits, 0)";

    const createdAtLocalExpression = "up.created_at AT TIME ZONE :reportTimezone";
    const bookingStartsAtLocalExpression = "b.starts_at AT TIME ZONE :reportTimezone";
    const sessionStartsAtLocalExpression = "s.starts_at AT TIME ZONE :reportTimezone";

    const dayStartExpression = "date_trunc('day', now() AT TIME ZONE :reportTimezone)";
    const weekStartExpression = "date_trunc('week', now() AT TIME ZONE :reportTimezone)";
    const monthStartExpression = "date_trunc('month', now() AT TIME ZONE :reportTimezone)";
    const yearStartExpression = "date_trunc('year', now() AT TIME ZONE :reportTimezone)";

    const revenueRawPromise = AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .innerJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = up.tenant_id")
      .select(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${dayStartExpression} THEN ${saleAmountExpression} ELSE 0 END), 0)`,
        "daily_revenue"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${weekStartExpression} THEN ${saleAmountExpression} ELSE 0 END), 0)`,
        "weekly_revenue"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${monthStartExpression} THEN ${saleAmountExpression} ELSE 0 END), 0)`,
        "monthly_revenue"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${yearStartExpression} THEN ${saleAmountExpression} ELSE 0 END), 0)`,
        "yearly_revenue"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${weekStartExpression} THEN ${creditsExpression} ELSE 0 END), 0)`,
        "weekly_credits_sold"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${monthStartExpression} THEN ${creditsExpression} ELSE 0 END), 0)`,
        "monthly_credits_sold"
      )
      .addSelect(
        `COALESCE(COUNT(CASE WHEN ${createdAtLocalExpression} >= ${weekStartExpression} THEN 1 END), 0)`,
        "weekly_package_count"
      )
      .addSelect(
        `COALESCE(COUNT(CASE WHEN ${createdAtLocalExpression} >= ${monthStartExpression} THEN 1 END), 0)`,
        "monthly_package_count"
      )
      .addSelect(
        `COALESCE(COUNT(CASE WHEN ${createdAtLocalExpression} >= ${yearStartExpression} THEN 1 END), 0)`,
        "yearly_package_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${weekStartExpression} AND ${creditsExpression} = 8 THEN 1 ELSE 0 END), 0)`,
        "weekly_pack_8_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${weekStartExpression} AND ${creditsExpression} = 4 THEN 1 ELSE 0 END), 0)`,
        "weekly_pack_4_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${monthStartExpression} AND ${creditsExpression} = 8 THEN 1 ELSE 0 END), 0)`,
        "monthly_pack_8_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${monthStartExpression} AND ${creditsExpression} = 4 THEN 1 ELSE 0 END), 0)`,
        "monthly_pack_4_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${yearStartExpression} AND ${creditsExpression} = 8 THEN 1 ELSE 0 END), 0)`,
        "yearly_pack_8_count"
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${createdAtLocalExpression} >= ${yearStartExpression} AND ${creditsExpression} = 4 THEN 1 ELSE 0 END), 0)`,
        "yearly_pack_4_count"
      )
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.deleted_at IS NULL")
      .setParameter("reportTimezone", reportTimezone)
      .getRawOne<{
        daily_revenue: string;
        weekly_revenue: string;
        monthly_revenue: string;
        yearly_revenue: string;
        weekly_credits_sold: string;
        monthly_credits_sold: string;
        weekly_package_count: string;
        monthly_package_count: string;
        yearly_package_count: string;
        weekly_pack_8_count: string;
        weekly_pack_4_count: string;
        monthly_pack_8_count: string;
        monthly_pack_4_count: string;
        yearly_pack_8_count: string;
        yearly_pack_4_count: string;
      }>();

    const [
      totalLeads,
      newLeads,
      contactedLeads,
      wonLeads,
      lostLeads,
      totalPackages,
      activePackages,
      visiblePackages,
      publicPackages,
      activeTrainers,
      activeMembers,
      todayBookings,
      todaySessions,
      riskAtRisk,
      revenueRaw,
      trainerSpotlight,
      memberSpotlight,
    ] = await Promise.all([
      leadRepo.count({ where: baseWhere }),
      leadRepo.count({ where: { ...baseWhere, status: LeadStatus.NEW } }),
      leadRepo.count({ where: { ...baseWhere, status: LeadStatus.CONTACTED } }),
      leadRepo.count({ where: { ...baseWhere, status: LeadStatus.WON } }),
      leadRepo.count({ where: { ...baseWhere, status: LeadStatus.LOST } }),

      packageRepo.count({ where: baseWhere }),
      packageRepo.count({ where: { ...baseWhere, is_active: true } }),
      packageRepo.count({ where: { ...baseWhere, is_active: true, is_visible: true } }),
      packageRepo.count({ where: { ...baseWhere, is_active: true, is_visible: true, is_public: true } }),

      userRepo.count({
        where: { tenant_id: tenantId, role: UserRole.TRAINER, is_active: true },
      }),
      userRepo.count({
        where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true },
      }),

      AppDataSource.getRepository(Booking)
        .createQueryBuilder("b")
        .where("b.tenant_id = :tenantId", { tenantId })
        .andWhere("b.status IN (:...statuses)", {
          statuses: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
        })
        .andWhere(`${bookingStartsAtLocalExpression} >= ${dayStartExpression}`)
        .andWhere(`${bookingStartsAtLocalExpression} < ${dayStartExpression} + interval '1 day'`)
        .setParameter("reportTimezone", reportTimezone)
        .getCount(),

      AppDataSource.getRepository(ClassSession)
        .createQueryBuilder("s")
        .where("s.tenant_id = :tenantId", { tenantId })
        .andWhere("s.status IN (:...statuses)", {
          statuses: [SessionStatus.SCHEDULED, SessionStatus.COMPLETED],
        })
        .andWhere(`${sessionStartsAtLocalExpression} >= ${dayStartExpression}`)
        .andWhere(`${sessionStartsAtLocalExpression} < ${dayStartExpression} + interval '1 day'`)
        .setParameter("reportTimezone", reportTimezone)
        .getCount(),

      RiskService.listRiskMembers({
        tenantId,
        memberActivity: "ACTIVE",
        riskSegment: "AT_RISK",
        limit: 5,
      }),

      revenueRawPromise,

      userRepo.find({
        where: { tenant_id: tenantId, role: UserRole.TRAINER, is_active: true },
        select: ["id", "first_name", "last_name", "email", "is_active"],
        order: { created_at: "DESC" },
        take: 8,
      }),

      userRepo.find({
        where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true },
        select: ["id", "first_name", "last_name", "email", "is_active"],
        order: { created_at: "DESC" },
        take: 8,
      }),
    ]);

    const toNumber = (value?: string | null) => Number(value || 0);

    return {
      tenant_id: tenantId,
      report_timezone: reportTimezone,

      kpis: {
        active_trainers: activeTrainers,
        active_members: activeMembers,
        at_risk_members: riskAtRisk.total,
        todays_bookings: todayBookings,
        todays_sessions: todaySessions,
      },

      leads: {
        total: totalLeads,
        by_status: {
          NEW: newLeads,
          CONTACTED: contactedLeads,
          WON: wonLeads,
          LOST: lostLeads,
        },
      },

      packages: {
        total: totalPackages,
        active: activePackages,
        visible_active: visiblePackages,
        public_active: publicPackages,
      },

      revenue: {
        daily: toNumber(revenueRaw?.daily_revenue),
        weekly: toNumber(revenueRaw?.weekly_revenue),
        monthly: toNumber(revenueRaw?.monthly_revenue),
        yearly: toNumber(revenueRaw?.yearly_revenue),
      },

      package_sales: {
        weekly_credits_sold: toNumber(revenueRaw?.weekly_credits_sold),
        monthly_credits_sold: toNumber(revenueRaw?.monthly_credits_sold),

        weekly_package_count: toNumber(revenueRaw?.weekly_package_count),
        monthly_package_count: toNumber(revenueRaw?.monthly_package_count),
        yearly_package_count: toNumber(revenueRaw?.yearly_package_count),

        weekly_pack_8_count: toNumber(revenueRaw?.weekly_pack_8_count),
        weekly_pack_4_count: toNumber(revenueRaw?.weekly_pack_4_count),
        monthly_pack_8_count: toNumber(revenueRaw?.monthly_pack_8_count),
        monthly_pack_4_count: toNumber(revenueRaw?.monthly_pack_4_count),
        yearly_pack_8_count: toNumber(revenueRaw?.yearly_pack_8_count),
        yearly_pack_4_count: toNumber(revenueRaw?.yearly_pack_4_count),
      },

      risk_preview: riskAtRisk.data,

      spotlight: {
        trainers: trainerSpotlight,
        members: memberSpotlight,
      },
    };
  }

  // --- GET /api/admin/dashboard ---
  static async get(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      return res.json(await AdminDashboardController.buildSummary(tenantId));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error("Dashboard verileri getirilirken hata:", error);
      throw new AppError("DASHBOARD_ERROR", 500, "Dashboard verileri getirilirken hata oluştu");
    }
  }

  // --- GET /api/admin/dashboard/summary ---
  static async summary(req: AuthenticatedRequest, res: Response) {
    return AdminDashboardController.get(req, res);
  }
}