// Bu controller member tarafindaki home.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Attendance, AttendanceResult } from "../../entities/attendance.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { Measurement } from "../../entities/measurement.entity";
import { Referral, ReferralStatus } from "../../entities/referral.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { MemberCreditWalletService } from "../../services/member-credit-wallet.service";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { lessonCategoryLabel, packageDisplayName } from "../../services/presentation-label.service";

export class MemberHomeController {
  private static startOfIsoWeek(date: Date) {
    const dt = new Date(date);
    const day = dt.getDay() || 7;
    dt.setDate(dt.getDate() - day + 1);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private static endOfIsoWeek(date: Date) {
    const start = MemberHomeController.startOfIsoWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  // --- GET /api/member/home ---
  static async get(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.linkedUserId || req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const userRepo = AppDataSource.getRepository(User);
      const member = await userRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }

      const now = new Date();
      const weekStart = MemberHomeController.startOfIsoWeek(now);
      const weekEnd = MemberHomeController.endOfIsoWeek(now);
      const [activePackages, upcomingBookings, recentAttendance, measurements, referralRows, referralWalletCredits, profile, attendanceUsage, attendedThisWeek] = await Promise.all([
        AppDataSource.getRepository(UserPackage)
          .createQueryBuilder("up")
          .where("up.tenant_id = :tenantId", { tenantId })
          .andWhere("up.user_id = :memberId", { memberId })
          .andWhere("up.is_active = true")
          .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
          .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
          .orderBy("up.expires_at", "ASC", "NULLS LAST")
          .addOrderBy("up.created_at", "DESC")
          .getMany(),
        AppDataSource.getRepository(Booking)
          .createQueryBuilder("b")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.member_id = :memberId", { memberId })
          .andWhere("b.starts_at >= :now", { now })
          .andWhere("b.status IN (:...statuses)", {
            statuses: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
          })
          .orderBy("b.starts_at", "ASC")
          .limit(5)
          .getMany(),
        AppDataSource.getRepository(Attendance)
          .createQueryBuilder("a")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.member_id = :memberId", { memberId })
          .orderBy("a.created_at", "DESC")
          .limit(5)
          .getMany(),
        AppDataSource.getRepository(Measurement).find({
          where: { tenant_id: tenantId, member_id: memberId },
          order: { measured_at: "DESC" },
          take: 2,
        }),
        AppDataSource.getRepository(Referral)
          .createQueryBuilder("r")
          .select("r.status", "status")
          .addSelect("COUNT(*)::int", "count")
          .where("r.tenant_id = :tenantId", { tenantId })
          .andWhere("r.inviter_member_id = :memberId", { memberId })
          .groupBy("r.status")
          .getRawMany<{ status: ReferralStatus; count: string }>(),
        MemberCreditWalletService.getCredits(tenantId, memberId),
        AppDataSource.getRepository(SalonProfile).findOne({
          where: { tenant_id: tenantId },
          order: { updated_at: "DESC", created_at: "DESC" },
          select: ["id", "business_hours", "location", "updated_at", "created_at"],
        }),
        AppDataSource.getRepository(Attendance)
          .createQueryBuilder("a")
          .leftJoin(ClassSession, "s", "s.id = a.session_id AND s.tenant_id = a.tenant_id")
          .select("COUNT(*)::int", "attended_total")
          .addSelect("SUM(CASE WHEN s.lesson_category = :groupCategory THEN 1 ELSE 0 END)::int", "group_attended_total")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.member_id = :memberId", { memberId })
          .andWhere("a.result = :result", { result: AttendanceResult.CREDIT_DEDUCTED })
          .setParameter("groupCategory", "GRUP")
          .getRawOne<{ attended_total: string; group_attended_total: string }>(),
        AppDataSource.getRepository(Attendance)
          .createQueryBuilder("a")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.member_id = :memberId", { memberId })
          .andWhere("a.result = :result", { result: AttendanceResult.CREDIT_DEDUCTED })
          .andWhere("a.created_at >= :weekStart", { weekStart })
          .andWhere("a.created_at <= :weekEnd", { weekEnd })
          .getCount(),
      ]);

      const referralSummary = {
        invited: 0,
        converted: 0,
        rewarded: 0,
        canceled: 0,
        total: 0,
      };
      for (const row of referralRows) {
        const count = Number(row.count) || 0;
        if (row.status === ReferralStatus.INVITED) referralSummary.invited += count;
        else if (row.status === ReferralStatus.CONVERTED) referralSummary.converted += count;
        else if (row.status === ReferralStatus.REWARDED) referralSummary.rewarded += count;
        else if (row.status === ReferralStatus.CANCELED) referralSummary.canceled += count;
        referralSummary.total += count;
      }

      const packageSummary = {
        active_package_count: activePackages.length,
        total_remaining_credits: activePackages.reduce((sum, p) => sum + (p.remaining_credits || 0), 0),
        nearest_expiry: activePackages.find((p) => !!p.expires_at)?.expires_at ?? null,
      };

      const trainerIds = Array.from(
        new Set([
          ...upcomingBookings.map((row) => row.trainer_id).filter(Boolean),
          ...recentAttendance.map((row) => row.trainer_id).filter(Boolean),
        ])
      );
      const sessionIds = Array.from(
        new Set([
          ...upcomingBookings.map((row) => row.session_id).filter(Boolean),
          ...recentAttendance.map((row) => row.session_id).filter(Boolean),
        ])
      );
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

      const normalizedWeeklyClassHours = Math.min(7, Math.max(1, Number(member.weekly_class_hours || 1)));
      const attendedTotal = Number(attendanceUsage?.attended_total || 0);
      const groupAttendedTotal = Number(attendanceUsage?.group_attended_total || 0);
      const location =
        profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
          ? (profile.location as Record<string, unknown>)
          : {};
      const campaigns =
        location.campaigns && typeof location.campaigns === "object" && !Array.isArray(location.campaigns)
          ? (location.campaigns as Record<string, unknown>)
          : {};
      const activeReferralCampaigns = Array.isArray(campaigns.referral_campaigns)
        ? campaigns.referral_campaigns.filter((row) => {
            const item = row as Record<string, unknown>;
            return item.is_active === undefined ? true : Boolean(item.is_active);
          }).length
        : 0;
      const activeLoyaltyCampaigns = Array.isArray(campaigns.loyalty_campaigns)
        ? campaigns.loyalty_campaigns.filter((row) => {
            const item = row as Record<string, unknown>;
            return item.is_active === undefined ? true : Boolean(item.is_active);
          }).length
        : 0;
      const cancellationPolicy =
        campaigns.cancellation_policy && typeof campaigns.cancellation_policy === "object" && !Array.isArray(campaigns.cancellation_policy)
          ? (campaigns.cancellation_policy as Record<string, unknown>)
          : {};

      return res.json({
        data: {
          member: {
            id: member.id,
            full_name: `${member.first_name} ${member.last_name}`.trim(),
            email: member.email,
            phone: member.phone,
            is_active: member.is_active,
            weekly_class_hours: normalizedWeeklyClassHours,
          },
          packages: packageSummary,
          lesson_usage: {
            weekly_target: normalizedWeeklyClassHours,
            attended_this_week: attendedThisWeek,
            attended_total: attendedTotal,
            group_attended_total: groupAttendedTotal,
            remaining_total_credits: packageSummary.total_remaining_credits,
          },
          upcoming_bookings: upcomingBookings.map((row) => ({
            ...row,
            trainer_full_name: row.trainer_id ? trainerMap.get(row.trainer_id) ?? null : null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
            lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
            lesson_category_label: lessonCategoryLabel(
              row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
            ),
            package_name: packageDisplayName((row.meta as Record<string, unknown> | undefined)?.package_title),
            remaining_credits:
              typeof (row.meta as Record<string, unknown> | undefined)?.remaining_credits === "number"
                ? Number((row.meta as Record<string, unknown>)?.remaining_credits)
                : null,
          })),
          recent_attendance: recentAttendance.map((row) => ({
            ...row,
            trainer_full_name: trainerMap.get(row.trainer_id) ?? null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
            lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
            lesson_category_label: lessonCategoryLabel(
              row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null
            ),
          })),
          latest_measurement: measurements[0] || null,
          previous_measurement: measurements[1] || null,
          referrals: referralSummary,
          referral_wallet: {
            group_class_credits: referralWalletCredits,
          },
          campaigns: {
            active_referral_campaigns: activeReferralCampaigns,
            active_loyalty_campaigns: activeLoyaltyCampaigns,
            cancellation_policy: {
              min_hours_before_start: Math.max(
                1,
                Math.floor(Number(cancellationPolicy.min_hours_before_start) || 3)
              ),
              refund_policy: String(cancellationPolicy.refund_policy ?? "NO_REFUND"),
            },
          },
         calendar: {
          business_hours: profile?.business_hours ?? null,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member home get error:", error);
      throw new AppError("MEMBER_HOME_GET_ERROR", 500, "Member home verisi getirilemedi");
    }
  }

  // --- PATCH /api/member/home/weekly-class-hours ---
  static async setWeeklyClassHours(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const raw = Number(req.body?.weekly_class_hours);
      if (!Number.isFinite(raw)) {
        throw new AppError("VALIDATION_ERROR", 400, "weekly_class_hours sayisal olmalidir");
      }

      const weeklyClassHours = Math.floor(raw);
      if (weeklyClassHours < 1 || weeklyClassHours > 7) {
        throw new AppError("VALIDATION_ERROR", 400, "weekly_class_hours 1 ile 7 arasında olmalıdır");
      }

      const userRepo = AppDataSource.getRepository(User);
      const member = await userRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }

      member.weekly_class_hours = weeklyClassHours;
      await userRepo.save(member);

      return res.json({
        data: {
          member_id: member.id,
          weekly_class_hours: member.weekly_class_hours,
          required_weekly_slots: member.weekly_class_hours * 3,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member weekly class hours update error:", error);
      throw new AppError("MEMBER_WEEKLY_CLASS_HOURS_UPDATE_ERROR", 500, "Haftalik ders saati guncellenemedi");
    }
  }
}
