import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Attendance, AttendanceResult } from "../../entities/attendance.entity";
import {
  Booking,
  BookingCheckinStatus,
  BookingPaymentStatus,
  BookingStatus,
} from "../../entities/booking.entity";
import { ClassSession, LessonCategory, SessionStatus } from "../../entities/class-session.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { CreditLedger, CreditLedgerSource } from "../../entities/credit-ledger.entity";
import { MemberCreditWalletService } from "../../services/member-credit-wallet.service";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { MobileNotificationService } from "../../services/mobile-notification.service";
import { AuditLogService } from "../../services/audit-log.service";
import { Package, PackageType } from "../../entities/package.entity";

type CheckinParams = {
  req: AuthenticatedRequest;
  member: User;
  sessionId?: string;
  manualCode?: string;
  userPackageId?: string;
};

type SessionCheckinContext = {
  booking: Booking;
  session?: ClassSession | null;
};

type LoyaltyCampaign = {
  id: string;
  min_lessons: number;
  reward_type: string;
  reward_value: number;
  reward_label: string;
  is_active: boolean;
};

export class TrainerCheckinController {
  private static isDirectCreditRewardType(rewardType: string) {
    return rewardType === "GROUP_CLASS_CREDIT" || rewardType === "FREE_CLASS";
  }

  private static getActorTrainerId(req: AuthenticatedRequest) {
    return req.auth?.linkedUserId || req.auth?.sub || null;
  }

  private static parseCheckinPayload(rawCode: string) {
    const raw = String(rawCode || "").trim();

    if (!raw) {
      return {
        memberQr: "",
        userPackageId: undefined as string | undefined,
      };
    }

    const [memberQr, packagePart] = raw.split("::UP::");
    const normalizedPackageId = String(packagePart || "").trim();

    return {
      memberQr: String(memberQr || "").trim(),
      userPackageId: normalizedPackageId || undefined,
    };
  }

  private static async logCheckinAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      memberId: string;
      attendanceId: string;
      sessionId?: string;
      bookingId?: string | null;
      result: AttendanceResult;
      creditsDeducted: number;
      userPackageId?: string | null;
      creditSource?: string | null;
      manualCodeUsed?: boolean;
      qrUsed?: boolean;
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
      target_type: "attendance",
      target_id: input.attendanceId,
      metadata: {
        booking_id: input.bookingId ?? null,
        member_id: input.memberId,
        session_id: input.sessionId ?? null,
        result: input.result,
        credits_deducted: input.creditsDeducted,
        user_package_id: input.userPackageId ?? null,
        credit_source: input.creditSource ?? null,
        manual_code_used: Boolean(input.manualCodeUsed),
        qr_used: Boolean(input.qrUsed),
      },
    });
  }

  private static async findCurrentApprovedBooking(tenantId: string, trainerId: string, memberId: string) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    return AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.trainer_id = :trainerId", { trainerId })
      .andWhere("b.member_id = :memberId", { memberId })
      .andWhere("b.status = :status", { status: BookingStatus.APPROVED })
      .andWhere("b.starts_at <= :windowEnd", { windowEnd })
      .andWhere("b.ends_at >= :windowStart", { windowStart })
      .orderBy("b.starts_at", "ASC")
      .getOne();
  }

  private static async findDuplicateByBooking(tenantId: string, bookingId?: string | null) {
    if (!bookingId) return null;

    return AppDataSource.getRepository(Attendance).findOne({
      where: {
        tenant_id: tenantId,
        booking_id: bookingId,
        result: AttendanceResult.CREDIT_DEDUCTED,
      },
      order: { created_at: "DESC" },
    });
  }

  private static async findRecentDuplicate(
    tenantId: string,
    memberId: string,
    trainerId: string,
    sessionId?: string
  ) {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const qb = AppDataSource.getRepository(Attendance)
      .createQueryBuilder("a")
      .where("a.tenant_id = :tenantId", { tenantId })
      .andWhere("a.member_id = :memberId", { memberId })
      .andWhere("a.trainer_id = :trainerId", { trainerId })
      .andWhere("a.created_at >= :minTime", { minTime: twoMinutesAgo })
      .orderBy("a.created_at", "DESC");

    if (sessionId) {
      qb.andWhere("a.session_id = :sessionId", { sessionId });
    } else {
      qb.andWhere("a.session_id IS NULL");
    }

    return qb.getOne();
  }

  private static normalizeLoyaltyCampaigns(raw: unknown): LoyaltyCampaign[] {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

    const source = raw as Record<string, unknown>;
    const rows = Array.isArray(source.loyalty_campaigns) ? source.loyalty_campaigns : [];

    return rows
      .map((entry, index) => {
        const item = (entry ?? {}) as Record<string, unknown>;

        return {
          id: String(item.id ?? "").trim() || `loy-${index + 1}`,
          min_lessons: Math.max(1, Math.floor(Number(item.min_lessons) || 0)),
          reward_type: String(item.reward_type ?? "FREE_CLASS"),
          reward_value: Math.max(0, Number(item.reward_value) || 0),
          reward_label: String(item.reward_label ?? "").trim() || "Sadakat ödülü",
          is_active: item.is_active === undefined ? true : Boolean(item.is_active),
        };
      })
      .filter((row) => row.is_active)
      .sort((a, b) => a.min_lessons - b.min_lessons);
  }

  private static async getLoyaltyCampaigns(tenantId: string): Promise<LoyaltyCampaign[]> {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "location"],
    });

    const location =
      profile?.location && typeof profile.location === "object" && !Array.isArray(profile.location)
        ? (profile.location as Record<string, unknown>)
        : {};

    const campaigns =
      location.campaigns && typeof location.campaigns === "object" && !Array.isArray(location.campaigns)
        ? (location.campaigns as Record<string, unknown>)
        : {};

    return TrainerCheckinController.normalizeLoyaltyCampaigns(campaigns);
  }

  private static async hasLoyaltyRewardAlready(
    tenantId: string,
    memberId: string,
    campaignId: string,
    milestone: number,
    rewardType: string
  ) {
    if (TrainerCheckinController.isDirectCreditRewardType(rewardType)) {
      const ledger = await AppDataSource.getRepository(CreditLedger)
        .createQueryBuilder("cl")
        .where("cl.tenant_id = :tenantId", { tenantId })
        .andWhere("cl.member_id = :memberId", { memberId })
        .andWhere("cl.meta ->> 'campaign_id' = :campaignId", { campaignId })
        .andWhere("cl.meta ->> 'milestone' = :milestone", { milestone: String(milestone) })
        .getOne();

      return Boolean(ledger);
    }

    const claim = await AppDataSource.getRepository(NotificationEvent)
      .createQueryBuilder("ne")
      .where("ne.tenant_id = :tenantId", { tenantId })
      .andWhere("ne.member_id = :memberId", { memberId })
      .andWhere("ne.type = :type", { type: "CAMPAIGN_REWARD_CLAIM" })
      .andWhere("ne.payload ->> 'campaign_id' = :campaignId", { campaignId })
      .andWhere("ne.payload ->> 'milestone' = :milestone", { milestone: String(milestone) })
      .getOne();

    return Boolean(claim);
  }

  private static async grantLoyaltyReward(tenantId: string, memberId: string, campaign: LoyaltyCampaign) {
    const rewardValue = Math.max(1, Math.floor(campaign.reward_value || 1));

    if (TrainerCheckinController.isDirectCreditRewardType(campaign.reward_type)) {
      await MemberCreditWalletService.addCredits({
        tenantId,
        memberId,
        amount: rewardValue,
        source: CreditLedgerSource.MANUAL_ADJUST,
        referenceType: "LOYALTY_CAMPAIGN",
        referenceId: campaign.id,
        meta: {
          campaign_id: campaign.id,
          milestone: campaign.min_lessons,
          reward_type: campaign.reward_type,
          reward_label: campaign.reward_label,
        },
      });

      await MobileNotificationService.queuePush({
        tenantId,
        userId: memberId,
        roleScope: "MEMBER",
        type: "CAMPAIGN_REWARD_EARNED",
        title: "Sadakat ödülü kazandın",
        body: campaign.reward_label,
        deepLink: "/(member)/campaigns",
        meta: {
          campaign_id: campaign.id,
          reward_type: campaign.reward_type,
          reward_value: rewardValue,
        },
      });

      return;
    }

    await AppDataSource.getRepository(NotificationEvent).save(
      AppDataSource.getRepository(NotificationEvent).create({
        tenant_id: tenantId,
        member_id: memberId,
        type: "CAMPAIGN_REWARD_CLAIM",
        payload: {
          campaign_id: campaign.id,
          milestone: campaign.min_lessons,
          reward_type: campaign.reward_type,
          reward_value: rewardValue,
          reward_label: campaign.reward_label,
          status: "PENDING_CLAIM",
        },
        status: NotificationEventStatus.PROCESSED,
        processed_at: new Date(),
      })
    );

    await MobileNotificationService.queuePush({
      tenantId,
      userId: memberId,
      roleScope: "MEMBER",
      type: "CAMPAIGN_REWARD_EARNED",
      title: "Sadakat ödülü hazır",
      body: campaign.reward_label,
      deepLink: "/(member)/campaigns",
      meta: {
        campaign_id: campaign.id,
        reward_type: campaign.reward_type,
        reward_value: rewardValue,
      },
    });
  }

  private static async applyLoyaltyCampaignRewards(tenantId: string, memberId: string) {
    const [campaigns, totalAttendance] = await Promise.all([
      TrainerCheckinController.getLoyaltyCampaigns(tenantId),
      AppDataSource.getRepository(Attendance)
        .createQueryBuilder("a")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.member_id = :memberId", { memberId })
        .andWhere("a.result = :result", { result: AttendanceResult.CREDIT_DEDUCTED })
        .getCount(),
    ]);

    for (const campaign of campaigns) {
      if (totalAttendance < campaign.min_lessons) continue;

      const alreadyGranted = await TrainerCheckinController.hasLoyaltyRewardAlready(
        tenantId,
        memberId,
        campaign.id,
        campaign.min_lessons,
        campaign.reward_type
      );

      if (alreadyGranted) continue;

      await TrainerCheckinController.grantLoyaltyReward(tenantId, memberId, campaign);
    }
  }

  static async listLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = TrainerCheckinController.getActorTrainerId(req);

      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const memberId = req.query.member_id ? String(req.query.member_id).trim() : "";
      const rawLimit = req.query.limit ? Number(req.query.limit) : 20;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

      const qb = AppDataSource.getRepository(Attendance)
        .createQueryBuilder("a")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.trainer_id = :trainerId", { trainerId })
        .orderBy("a.created_at", "DESC")
        .limit(limit);

      if (memberId) {
        qb.andWhere("a.member_id = :memberId", { memberId });
      }

      const logs = await qb.getMany();

      return res.json({
        data: logs.map((log) => ({
          id: log.id,
          member_id: log.member_id,
          trainer_id: log.trainer_id,
          booking_id: log.booking_id ?? null,
          session_id: log.session_id ?? null,
          result: log.result,
          credits_deducted: log.credits_deducted,
          user_package_id: log.user_package_id ?? null,
          created_at: log.created_at,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer checkin logs error:", error);
      throw new AppError("TRAINER_CHECKIN_LOGS_ERROR", 500, "Check-in logları getirilirken sunucu hatası oluştu");
    }
  }

  private static async resolveMemberFromManualInput(tenantId: string, memberId?: string, manualCode?: string) {
    const userRepo = AppDataSource.getRepository(User);

    if (memberId) {
      return userRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
    }

    const code = String(manualCode ?? "").trim();

    if (!code) return null;

    return userRepo
      .createQueryBuilder("u")
      .where("u.tenant_id = :tenantId", { tenantId })
      .andWhere("u.role = :role", { role: UserRole.MEMBER })
      .andWhere("(u.email = :code OR u.phone = :code OR u.qr_code = :code OR u.id::text = :code)", {
        code,
      })
      .getOne();
  }

  private static async findDeductablePackageById(
    tenantId: string,
    memberId: string,
    userPackageId: string,
    now: Date
  ) {
    return AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id = :memberId", { memberId })
      .andWhere("up.id = :userPackageId", { userPackageId })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
      .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
      .getOne();
  }

  private static async findDeductablePackageByPackageId(
    tenantId: string,
    memberId: string,
    packageId: string,
    now: Date
  ) {
    return AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id = :memberId", { memberId })
      .andWhere("up.package_id = :packageId", { packageId })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
      .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
      .orderBy("up.expires_at", "ASC", "NULLS LAST")
      .addOrderBy("up.created_at", "ASC")
      .getOne();
  }

  private static lessonCategoryToPackageTypes(lessonCategory?: LessonCategory | null) {
    switch (lessonCategory) {
      case LessonCategory.GRUP:
        return [PackageType.GROUP];
      case LessonCategory.PT:
        return [PackageType.PT];
      case LessonCategory.REFORMER:
        return [PackageType.REFORMER];
      case LessonCategory.SKOLYOZ:
        return [PackageType.SCOLIOSIS];
      default:
        return [];
    }
  }

  private static async findDeductablePackageByLessonCategory(
    tenantId: string,
    memberId: string,
    lessonCategory: LessonCategory,
    now: Date
  ) {
    const packageTypes = TrainerCheckinController.lessonCategoryToPackageTypes(lessonCategory);

    return AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = up.tenant_id")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id = :memberId", { memberId })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
      .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
      .andWhere(
        [
          "UPPER(COALESCE(p.rules->>'lesson_category', '')) = :lessonCategory",
          "UPPER(COALESCE(p.rules->>'service_key', '')) = :lessonCategory",
          ...(packageTypes.length ? ["p.type IN (:...packageTypes)"] : []),
        ].join(" OR "),
        { lessonCategory, packageTypes }
      )
      .orderBy("up.expires_at", "ASC", "NULLS LAST")
      .addOrderBy("up.created_at", "ASC")
      .getOne();
  }

  private static async hasExpiredPackageWithCredit(tenantId: string, memberId: string, now: Date) {
    const count = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id = :memberId", { memberId })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("up.expires_at IS NOT NULL")
      .andWhere("up.expires_at < :now", { now })
      .getCount();

    return count > 0;
  }

  private static async persistAttendance(input: {
    tenantId: string;
    trainerId: string;
    memberId: string;
    result: AttendanceResult;
    creditsDeducted: number;
    sessionId?: string;
    bookingId?: string | null;
    userPackageId?: string | null;
    manualCode?: string;
    meta?: Record<string, unknown>;
  }) {
    const attendanceRepo = AppDataSource.getRepository(Attendance);

    const attendance = attendanceRepo.create({
      tenant_id: input.tenantId,
      trainer_id: input.trainerId,
      member_id: input.memberId,
      session_id: input.sessionId,
      booking_id: input.bookingId || undefined,
      user_package_id: input.userPackageId || undefined,
      credits_deducted: input.creditsDeducted,
      result: input.result,
      manual_code: input.manualCode,
      meta: input.meta || {},
    });

    return attendanceRepo.save(attendance);
  }

  private static async ensurePaymentApprovalForSessionCheckin(
    tenantId: string,
    trainerId: string,
    memberId: string,
    sessionId?: string
  ): Promise<SessionCheckinContext | null> {
    if (!sessionId) return null;

    const booking = await AppDataSource.getRepository(Booking).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        member_id: memberId,
        session_id: sessionId,
        status: BookingStatus.APPROVED,
      },
      order: { starts_at: "DESC" },
    });

    if (!booking) {
      throw new AppError("BOOKING_NOT_APPROVED", 400, "Seans check-in için onaylı booking bulunamadı");
    }

    if (booking.payment_status !== BookingPaymentStatus.APPROVED) {
      throw new AppError("PAYMENT_NOT_APPROVED", 400, "Ödeme onayı olmadan seans check-in yapılamaz");
    }

    const session = await AppDataSource.getRepository(ClassSession).findOne({
      where: { id: sessionId, tenant_id: tenantId, trainer_id: trainerId },
    });

    if (!session) {
      throw new AppError("SESSION_NOT_FOUND", 404, "Check-in için aktif seans bulunamadı");
    }

    if (session.status === SessionStatus.CANCELED) {
      throw new AppError("SESSION_CANCELED", 409, "İptal edilen ders için check-in yapılamaz");
    }

    const now = Date.now();
    const opensAt = new Date(session.starts_at).getTime() - 30 * 60 * 1000;
    const closesAt = new Date(session.ends_at || session.starts_at).getTime() + 30 * 60 * 1000;

    if (now < opensAt || now > closesAt) {
      throw new AppError(
        "CHECKIN_WINDOW_CLOSED",
        409,
        "Check-in yalnızca ders başlangıcından 30 dakika önce ve ders bitişinden 30 dakika sonra yapılabilir"
      );
    }

    return { booking, session };
  }

  private static async resolveSessionContext(input: {
    tenantId: string;
    trainerId: string;
    memberId: string;
    sessionId?: string;
  }): Promise<SessionCheckinContext | null> {
    const sessionContext = await TrainerCheckinController.ensurePaymentApprovalForSessionCheckin(
      input.tenantId,
      input.trainerId,
      input.memberId,
      input.sessionId
    );

    if (sessionContext) {
      return sessionContext;
    }

    const booking = await TrainerCheckinController.findCurrentApprovedBooking(
      input.tenantId,
      input.trainerId,
      input.memberId
    );

    if (!booking) {
      return null;
    }

    if (booking.payment_status !== BookingPaymentStatus.APPROVED) {
      throw new AppError("PAYMENT_NOT_APPROVED", 400, "Ödeme onayı olmadan check-in yapılamaz");
    }

    let session: ClassSession | null = null;

    if (booking.session_id) {
      session = await AppDataSource.getRepository(ClassSession).findOne({
        where: {
          id: booking.session_id,
          tenant_id: input.tenantId,
          trainer_id: input.trainerId,
        },
      });

      if (session?.status === SessionStatus.CANCELED) {
        throw new AppError("SESSION_CANCELED", 409, "İptal edilen ders için check-in yapılamaz");
      }
    }

    return {
      booking,
      session,
    };
  }

  private static async resolveUserPackageForCheckin(
    tenantId: string,
    memberId: string,
    now: Date,
    userPackageId?: string,
    sessionContext?: SessionCheckinContext | null
  ) {
    if (!sessionContext) {
      return null;
    }

    const bookingMeta = (sessionContext.booking.meta as Record<string, unknown> | undefined) || {};
    const scheduledPackageId = String(
      bookingMeta.package_id ?? sessionContext.session?.related_package_id ?? ""
    ).trim();

    if (scheduledPackageId) {
      if (userPackageId) {
        const requestedPackage = await TrainerCheckinController.findDeductablePackageById(
          tenantId,
          memberId,
          userPackageId,
          now
        );

        if (requestedPackage?.package_id === scheduledPackageId) {
          return requestedPackage;
        }
      }

      const exactMatch = await TrainerCheckinController.findDeductablePackageByPackageId(
        tenantId,
        memberId,
        scheduledPackageId,
        now
      );

      if (exactMatch) return exactMatch;
    }

    if (sessionContext.session?.lesson_category) {
      const categoryMatch = await TrainerCheckinController.findDeductablePackageByLessonCategory(
        tenantId,
        memberId,
        sessionContext.session.lesson_category,
        now
      );

      if (categoryMatch) return categoryMatch;
    }

    return null;
  }

  private static async markBookingCompleted(input: {
    booking: Booking;
    trainerId: string;
    source: "QR" | "MANUAL";
    creditSource: "PACKAGE" | "REFERRAL_WALLET";
    userPackageId?: string | null;
    remainingCreditsAfter?: number | null;
    checkedInAt: Date;
  }) {
    input.booking.checkin_status = BookingCheckinStatus.COMPLETED;
    input.booking.checked_in_at = input.checkedInAt;
    input.booking.checked_in_by_trainer_id = input.trainerId;
    input.booking.checked_in_user_package_id = input.userPackageId || null;
    input.booking.credits_charged = 1;
    input.booking.meta = {
      ...(input.booking.meta || {}),
      checkin: {
        source: input.source,
        credit_source: input.creditSource,
        checked_in_at: input.checkedInAt.toISOString(),
        user_package_id: input.userPackageId ?? null,
        remaining_credits_after: input.remainingCreditsAfter ?? null,
      },
    };

    await AppDataSource.getRepository(Booking).save(input.booking);
  }

  private static async runCheckin({ req, member, sessionId, manualCode, userPackageId }: CheckinParams, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = TrainerCheckinController.getActorTrainerId(req);

    if (!tenantId || !trainerId) {
      throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
    }

    const source: "QR" | "MANUAL" = manualCode ? "MANUAL" : "QR";

    const sessionContext = await TrainerCheckinController.resolveSessionContext({
      tenantId,
      trainerId,
      memberId: member.id,
      sessionId,
    });

    if (!sessionContext) {
      throw new AppError(
        "CHECKIN_WINDOW_CLOSED",
        409,
        "Şu an bu üye için check-in yapılabilecek onaylı ders bulunamadı. Check-in yalnızca ders başlangıcından 30 dakika önce ve ders bitişinden 30 dakika sonra yapılabilir."
      );
    }

    const resolvedSessionId = sessionId || sessionContext.booking.session_id || undefined;
    const bookingId = sessionContext.booking.id;

    const bookingDuplicate = await TrainerCheckinController.findDuplicateByBooking(tenantId, bookingId);

    if (bookingDuplicate) {
      await TrainerCheckinController.logCheckinAudit(req, {
        eventType: "CHECKIN_DUPLICATE_RETURNED",
        memberId: member.id,
        attendanceId: bookingDuplicate.id,
        bookingId,
        sessionId: resolvedSessionId,
        result: bookingDuplicate.result,
        creditsDeducted: bookingDuplicate.credits_deducted,
        userPackageId: bookingDuplicate.user_package_id ?? null,
        manualCodeUsed: source === "MANUAL",
        qrUsed: source === "QR",
      });

      return res.json({
        data: {
          attendanceId: bookingDuplicate.id,
          bookingId,
          memberId: member.id,
          result: bookingDuplicate.result,
          creditsDeducted: bookingDuplicate.credits_deducted,
          userPackageId: bookingDuplicate.user_package_id ?? null,
          remainingCredits: null,
          idempotent: true,
          message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
        },
      });
    }

    if (sessionContext.booking.checkin_status === BookingCheckinStatus.COMPLETED) {
      return res.json({
        data: {
          bookingId,
          memberId: member.id,
          result: AttendanceResult.CREDIT_DEDUCTED,
          creditsDeducted: 0,
          userPackageId: sessionContext.booking.checked_in_user_package_id ?? null,
          remainingCredits: null,
          idempotent: true,
          message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
        },
      });
    }

    const recentDuplicate = await TrainerCheckinController.findRecentDuplicate(
      tenantId,
      member.id,
      trainerId,
      resolvedSessionId
    );

    if (recentDuplicate) {
      await TrainerCheckinController.logCheckinAudit(req, {
        eventType: "CHECKIN_DUPLICATE_RETURNED",
        memberId: member.id,
        attendanceId: recentDuplicate.id,
        bookingId,
        sessionId: resolvedSessionId,
        result: recentDuplicate.result,
        creditsDeducted: recentDuplicate.credits_deducted,
        userPackageId: recentDuplicate.user_package_id ?? null,
        manualCodeUsed: source === "MANUAL",
        qrUsed: source === "QR",
      });

      return res.json({
        data: {
          attendanceId: recentDuplicate.id,
          bookingId,
          memberId: member.id,
          result: recentDuplicate.result,
          creditsDeducted: recentDuplicate.credits_deducted,
          userPackageId: recentDuplicate.user_package_id ?? null,
          idempotent: true,
          message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
        },
      });
    }

    if (!member.is_active) {
      const attendance = await TrainerCheckinController.persistAttendance({
        tenantId,
        trainerId,
        memberId: member.id,
        result: AttendanceResult.USER_INACTIVE,
        creditsDeducted: 0,
        sessionId: resolvedSessionId,
        bookingId,
        manualCode,
        meta: {
          booking_id: bookingId,
          rejection_reason: "USER_INACTIVE",
        },
      });

      await TrainerCheckinController.logCheckinAudit(req, {
        eventType: "CHECKIN_REJECTED_USER_INACTIVE",
        memberId: member.id,
        attendanceId: attendance.id,
        bookingId,
        sessionId: resolvedSessionId,
        result: AttendanceResult.USER_INACTIVE,
        creditsDeducted: 0,
        manualCodeUsed: source === "MANUAL",
        qrUsed: source === "QR",
      });

      return res.status(400).json({
        data: {
          attendanceId: attendance.id,
          bookingId,
          memberId: member.id,
          result: AttendanceResult.USER_INACTIVE,
          creditsDeducted: 0,
          idempotent: false,
          message: "Üye aktif olmadığı için check-in yapılamadı.",
        },
      });
    }

    const now = new Date();
    const bookingMeta = (sessionContext.booking.meta as Record<string, unknown> | undefined) || {};
    const expectedPackageId = String(
      bookingMeta.package_id ?? sessionContext.session?.related_package_id ?? ""
    ).trim() || null;

    const userPackage = await TrainerCheckinController.resolveUserPackageForCheckin(
      tenantId,
      member.id,
      now,
      userPackageId,
      sessionContext
    );

    if (!userPackage) {
      const referralResult = await AppDataSource.transaction(async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const attendanceRepo = manager.getRepository(Attendance);
        const lockedBooking = await bookingRepo.findOne({
          where: { tenant_id: tenantId, id: bookingId },
          lock: { mode: "pessimistic_write" },
        });
        if (!lockedBooking) {
          throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
        }
        if (lockedBooking.checkin_status === BookingCheckinStatus.COMPLETED) {
          const duplicateAttendance = await attendanceRepo.findOne({
            where: { tenant_id: tenantId, booking_id: bookingId, result: AttendanceResult.CREDIT_DEDUCTED },
            order: { created_at: "DESC" },
          });
          return {
            consumed: false as const,
            idempotent: true,
            attendance: duplicateAttendance,
            booking: lockedBooking,
            wallet: null,
          };
        }

        const duplicateAttendance = await attendanceRepo.findOne({
          where: { tenant_id: tenantId, booking_id: bookingId, result: AttendanceResult.CREDIT_DEDUCTED },
          order: { created_at: "DESC" },
        });
        if (duplicateAttendance) {
          return {
            consumed: false as const,
            idempotent: true,
            attendance: duplicateAttendance,
            booking: lockedBooking,
            wallet: null,
          };
        }

        const referralCreditConsume = await MemberCreditWalletService.consumeOneCreditWithManager(manager, {
          tenantId,
          memberId: member.id,
          source: CreditLedgerSource.CHECKIN_USE,
          referenceType: "ATTENDANCE",
          referenceId: bookingId,
          meta: {
            checkin_mode: resolvedSessionId ? "SESSION" : "MANUAL_OR_QR",
            booking_id: bookingId,
          },
        });

        if (!referralCreditConsume.consumed) {
          return {
            consumed: false as const,
            idempotent: false,
            attendance: null,
            booking: lockedBooking,
            wallet: referralCreditConsume.wallet,
          };
        }

        lockedBooking.checkin_status = BookingCheckinStatus.COMPLETED;
        lockedBooking.checked_in_at = now;
        lockedBooking.checked_in_by_trainer_id = trainerId;
        lockedBooking.checked_in_user_package_id = null;
        lockedBooking.credits_charged = 1;
        lockedBooking.meta = {
          ...(lockedBooking.meta || {}),
          checkin: {
            source,
            credit_source: "REFERRAL_WALLET",
            checked_in_at: now.toISOString(),
            user_package_id: null,
            remaining_credits_after: referralCreditConsume.wallet.referral_group_credits,
          },
        };
        await bookingRepo.save(lockedBooking);

        const attendance = attendanceRepo.create({
          tenant_id: tenantId,
          trainer_id: trainerId,
          member_id: member.id,
          result: AttendanceResult.CREDIT_DEDUCTED,
          credits_deducted: 1,
          session_id: resolvedSessionId,
          booking_id: bookingId,
          manual_code: manualCode,
          meta: {
            booking_id: bookingId,
            expected_package_id: expectedPackageId,
            resolution_strategy: "REFERRAL_WALLET",
          },
        });
        const savedAttendance = await attendanceRepo.save(attendance);

        return {
          consumed: true as const,
          idempotent: false,
          attendance: savedAttendance,
          booking: lockedBooking,
          wallet: referralCreditConsume.wallet,
        };
      });

      if (referralResult.idempotent) {
        return res.json({
          data: {
            attendanceId: referralResult.attendance?.id ?? null,
            bookingId,
            memberId: member.id,
            result: AttendanceResult.CREDIT_DEDUCTED,
            creditsDeducted: 0,
            remainingCredits: referralResult.wallet?.referral_group_credits ?? null,
            userPackageId: null,
            creditSource: "REFERRAL_WALLET",
            idempotent: true,
            message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
          },
        });
      }

      if (referralResult.consumed && referralResult.attendance && referralResult.wallet) {
        const attendance = referralResult.attendance;

        await TrainerCheckinController.logCheckinAudit(req, {
          eventType: "CHECKIN_CREDIT_DEDUCTED",
          memberId: member.id,
          attendanceId: attendance.id,
          bookingId,
          sessionId: resolvedSessionId,
          result: AttendanceResult.CREDIT_DEDUCTED,
          creditsDeducted: 1,
          creditSource: "REFERRAL_WALLET",
          manualCodeUsed: source === "MANUAL",
          qrUsed: source === "QR",
        });

        await TrainerCheckinController.applyLoyaltyCampaignRewards(tenantId, member.id);

        await MobileNotificationService.queuePush({
          tenantId,
          userId: member.id,
          roleScope: "MEMBER",
          type: "CHECKIN_RECORDED",
          title: "Ders katılımı kaydedildi",
          body: "Katılım işlendi ve hak düşümü tamamlandı.",
          deepLink: "/(member)/attendance",
          meta: {
            attendance_id: attendance.id,
            booking_id: bookingId,
            source: "REFERRAL_WALLET",
          },
        });

        return res.json({
          data: {
            attendanceId: attendance.id,
            bookingId,
            memberId: member.id,
            result: AttendanceResult.CREDIT_DEDUCTED,
            creditsDeducted: 1,
            remainingCredits: referralResult.wallet.referral_group_credits,
            userPackageId: null,
            creditSource: "REFERRAL_WALLET",
            idempotent: false,
            message: "Check-in tamamlandı. Referans/sadakat hakkından 1 ders düşüldü.",
          },
        });
      }

      const isExpired = await TrainerCheckinController.hasExpiredPackageWithCredit(tenantId, member.id, now);
      const result = isExpired ? AttendanceResult.PACKAGE_EXPIRED : AttendanceResult.NO_CREDIT;

      const attendance = await TrainerCheckinController.persistAttendance({
        tenantId,
        trainerId,
        memberId: member.id,
        result,
        creditsDeducted: 0,
        sessionId: resolvedSessionId,
        bookingId,
        manualCode,
        meta: {
          booking_id: bookingId,
          expected_package_id: expectedPackageId,
          resolution_strategy: result,
        },
      });

      await TrainerCheckinController.logCheckinAudit(req, {
        eventType:
          result === AttendanceResult.PACKAGE_EXPIRED
            ? "CHECKIN_REJECTED_PACKAGE_EXPIRED"
            : "CHECKIN_REJECTED_NO_CREDIT",
        memberId: member.id,
        attendanceId: attendance.id,
        bookingId,
        sessionId: resolvedSessionId,
        result,
        creditsDeducted: 0,
        manualCodeUsed: source === "MANUAL",
        qrUsed: source === "QR",
      });

      return res.status(400).json({
        data: {
          attendanceId: attendance.id,
          bookingId,
          memberId: member.id,
          result,
          creditsDeducted: 0,
          warning: result === AttendanceResult.PACKAGE_EXPIRED ? "Paket süresi dolmuş" : "Kalan hak yok",
          idempotent: false,
          message: result === AttendanceResult.PACKAGE_EXPIRED ? "Paket süresi dolmuş." : "Üyenin kalan hakkı yok.",
        },
      });
    }

      const checkinResult = await AppDataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const attendanceRepo = manager.getRepository(Attendance);
      const userPackageRepo = manager.getRepository(UserPackage);

      const lockedBooking = await bookingRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: bookingId,
        },
        lock: {
          mode: "pessimistic_write",
        },
      });

      if (!lockedBooking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
      }

      if (lockedBooking.checkin_status === BookingCheckinStatus.COMPLETED) {
        return {
          idempotent: true,
          attendance: null,
          userPackage,
          booking: lockedBooking,
          message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
        };
      }

      const duplicateAttendance = await attendanceRepo.findOne({
        where: {
          tenant_id: tenantId,
          booking_id: bookingId,
          result: AttendanceResult.CREDIT_DEDUCTED,
        },
        order: { created_at: "DESC" },
      });

      if (duplicateAttendance) {
        return {
          idempotent: true,
          attendance: duplicateAttendance,
          userPackage,
          booking: lockedBooking,
          message: "Bu ders için check-in zaten tamamlandı. Tekrar hak düşülmedi.",
        };
      }

      const lockedUserPackage = await userPackageRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: userPackage.id,
          user_id: member.id,
          is_active: true,
        },
        lock: {
          mode: "pessimistic_write",
        },
      });

      if (!lockedUserPackage) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Üye paketi bulunamadı");
      }

      if (lockedUserPackage.remaining_credits <= 0) {
        throw new AppError("NO_CREDIT", 400, "Üyenin kalan hakkı yok");
      }

      lockedUserPackage.remaining_credits -= 1;

      if (lockedUserPackage.remaining_credits < 0) {
        lockedUserPackage.remaining_credits = 0;
      }

      await userPackageRepo.save(lockedUserPackage);

      lockedBooking.checkin_status = BookingCheckinStatus.COMPLETED;
      lockedBooking.checked_in_at = now;
      lockedBooking.checked_in_by_trainer_id = trainerId;
      lockedBooking.checked_in_user_package_id = lockedUserPackage.id;
      lockedBooking.credits_charged = 1;
      lockedBooking.meta = {
        ...(lockedBooking.meta || {}),
        checkin: {
          source,
          credit_source: "PACKAGE",
          checked_in_at: now.toISOString(),
          user_package_id: lockedUserPackage.id,
          remaining_credits_after: lockedUserPackage.remaining_credits,
        },
      };

      await bookingRepo.save(lockedBooking);

      const attendance = attendanceRepo.create({
        tenant_id: tenantId,
        trainer_id: trainerId,
        member_id: member.id,
        result: AttendanceResult.CREDIT_DEDUCTED,
        credits_deducted: 1,
        session_id: resolvedSessionId,
        booking_id: bookingId,
        user_package_id: lockedUserPackage.id,
        manual_code: manualCode,
        meta: {
          booking_id: bookingId,
          expected_package_id: expectedPackageId,
          resolved_package_id: lockedUserPackage.package_id,
          resolution_strategy: "SCHEDULED_SESSION_PACKAGE",
        },
      });

      const savedAttendance = await attendanceRepo.save(attendance);

      return {
        idempotent: false,
        attendance: savedAttendance,
        userPackage: lockedUserPackage,
        booking: lockedBooking,
        message: "Check-in tamamlandı. Paket hakkından 1 ders düşüldü.",
      };
    });

    if (checkinResult.idempotent) {
      return res.json({
        data: {
          attendanceId: checkinResult.attendance?.id ?? null,
          bookingId,
          memberId: member.id,
          result: AttendanceResult.CREDIT_DEDUCTED,
          creditsDeducted: 0,
          remainingCredits: checkinResult.userPackage.remaining_credits,
          userPackageId: checkinResult.userPackage.id,
          creditSource: "PACKAGE",
          idempotent: true,
          message: checkinResult.message,
        },
      });
    }

    const attendance = checkinResult.attendance;

    if (!attendance) {
      throw new AppError("ATTENDANCE_NOT_CREATED", 500, "Attendance kaydı oluşturulamadı");
    }

    await TrainerCheckinController.logCheckinAudit(req, {
      eventType: "CHECKIN_CREDIT_DEDUCTED",
      memberId: member.id,
      attendanceId: attendance.id,
      bookingId,
      sessionId: resolvedSessionId,
      result: AttendanceResult.CREDIT_DEDUCTED,
      creditsDeducted: 1,
      userPackageId: checkinResult.userPackage.id,
      creditSource: "PACKAGE",
      manualCodeUsed: source === "MANUAL",
      qrUsed: source === "QR",
    });

    await TrainerCheckinController.applyLoyaltyCampaignRewards(tenantId, member.id);

    await MobileNotificationService.queuePush({
      tenantId,
      userId: member.id,
      roleScope: "MEMBER",
      type: "CHECKIN_RECORDED",
      title: "Ders katılımı kaydedildi",
      body: "Katılım işlendi ve paket hakkından 1 ders düşüldü.",
      deepLink: "/(member)/attendance",
      meta: {
        attendance_id: attendance.id,
        booking_id: bookingId,
        user_package_id: checkinResult.userPackage.id,
      },
    });

    return res.json({
      data: {
        attendanceId: attendance.id,
        bookingId,
        memberId: member.id,
        result: AttendanceResult.CREDIT_DEDUCTED,
        creditsDeducted: 1,
        remainingCredits: checkinResult.userPackage.remaining_credits,
        userPackageId: checkinResult.userPackage.id,
        creditSource: "PACKAGE",
        idempotent: false,
        message: checkinResult.message,
      },
    });
  }

  static async checkinByQr(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const qrCode = String(req.body?.qr_code ?? "").trim();
      const sessionId = req.body?.session_id ? String(req.body.session_id) : undefined;

      if (!qrCode) {
        throw new AppError("VALIDATION_ERROR", 400, "qr_code zorunludur");
      }

      const parsed = TrainerCheckinController.parseCheckinPayload(qrCode);

      const member = await AppDataSource.getRepository(User).findOne({
        where: {
          tenant_id: tenantId,
          qr_code: parsed.memberQr,
          role: UserRole.MEMBER,
        },
      });

      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "QR koduna ait üye bulunamadı");
      }

      return TrainerCheckinController.runCheckin(
        {
          req,
          member,
          sessionId,
          userPackageId: parsed.userPackageId,
        },
        res
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer QR checkin error:", error);
      throw new AppError("TRAINER_CHECKIN_QR_ERROR", 500, "QR check-in işleminde sunucu hatası oluştu");
    }
  }

  static async checkinManual(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const memberId = req.body?.member_id ? String(req.body.member_id) : undefined;
      const manualCode = req.body?.manual_code ? String(req.body.manual_code) : undefined;
      const sessionId = req.body?.session_id ? String(req.body.session_id) : undefined;

      if (!memberId && !manualCode) {
        throw new AppError("VALIDATION_ERROR", 400, "member_id veya manual_code zorunludur");
      }

      const parsed = manualCode ? TrainerCheckinController.parseCheckinPayload(manualCode) : null;

      const member = await TrainerCheckinController.resolveMemberFromManualInput(
        tenantId,
        memberId,
        parsed?.memberQr || manualCode
      );

      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
      }

      return TrainerCheckinController.runCheckin(
        {
          req,
          member,
          sessionId,
          manualCode,
          userPackageId: parsed?.userPackageId,
        },
        res
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer manual checkin error:", error);
      throw new AppError("TRAINER_CHECKIN_MANUAL_ERROR", 500, "Manual check-in işleminde sunucu hatası oluştu");
    }
  }
}
