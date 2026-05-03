// Bu servis modulu backend tarafinda risk.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Attendance } from "../entities/attendance.entity";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { Measurement } from "../entities/measurement.entity";
import { Referral, ReferralStatus } from "../entities/referral.entity";
import { RetentionScore } from "../entities/retention-score.entity";
import { User, UserRole } from "../entities/user.entity";
import { UserPackage } from "../entities/user-package.entity";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type RiskSegment = "AT_RISK" | "HEALTHY" | "ALL";
export type MemberActivityFilter = "ACTIVE" | "INACTIVE" | "ALL";

export type MemberRiskItem = {
  member_id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  score: number;
  level: RiskLevel;
  risk_label: "COK_RISKLI" | "RISKLI" | "STABIL";
  calculated_at: Date;
  days_since_attendance: number | null;
  days_since_measurement: number | null;
  active_package_count: number;
  remaining_credits: number;
  approved_bookings_30d: number;
  referrals_converted: number;
  reasons: string[];
  latest_saved_score: number | null;
  latest_saved_at: Date | null;
  breakdown: Record<string, unknown>;
};

type RiskSignals = {
  daysSinceAttendance: number | null;
  daysSinceMeasurement: number | null;
  activePackageCount: number;
  remainingCredits: number;
  approvedBookings30d: number;
  convertedReferrals: number;
};

type LatestRetentionRow = {
  score: number;
  calculated_at: Date;
};

export class RiskService {
  private static daysSince(value?: Date | string | null) {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return Math.floor((Date.now() - dt.getTime()) / DAY_MS);
  }

  private static toLevel(score: number): RiskLevel {
    if (score < 40) return "HIGH";
    if (score < 70) return "MEDIUM";
    return "LOW";
  }

  private static toRiskLabel(level: RiskLevel): "COK_RISKLI" | "RISKLI" | "STABIL" {
    if (level === "HIGH") return "COK_RISKLI";
    if (level === "MEDIUM") return "RISKLI";
    return "STABIL";
  }

  private static normalizeLimit(raw: number | undefined) {
    if (!Number.isFinite(raw)) return undefined;
    const n = Number(raw);
    if (n < 1) return 1;
    if (n > 500) return 500;
    return Math.floor(n);
  }

  private static attendanceScore(days: number | null) {
    if (days === null) return 35;
    if (days <= 3) return 95;
    if (days <= 7) return 85;
    if (days <= 14) return 70;
    if (days <= 30) return 50;
    if (days <= 45) return 35;
    return 20;
  }

  private static packageScore(activeCount: number, remainingCredits: number) {
    if (activeCount <= 0) return 25;
    if (remainingCredits <= 0) return 35;
    if (remainingCredits <= 2) return 60;
    return 90;
  }

  private static measurementScore(days: number | null) {
    if (days === null) return 45;
    if (days <= 14) return 90;
    if (days <= 30) return 75;
    if (days <= 60) return 55;
    if (days <= 90) return 40;
    return 25;
  }

  private static engagementScore(approvedBookings30d: number) {
    if (approvedBookings30d >= 6) return 95;
    if (approvedBookings30d >= 3) return 80;
    if (approvedBookings30d >= 1) return 60;
    return 35;
  }

  private static referralScore(convertedReferrals: number) {
    if (convertedReferrals >= 3) return 90;
    if (convertedReferrals >= 1) return 75;
    return 55;
  }

  private static buildReasons(member: User, signals: RiskSignals) {
    const reasons: string[] = [];
    if (!member.is_active) reasons.push("Üye hesabı pasif");
    if (signals.activePackageCount <= 0) reasons.push("Aktif paket bulunmuyor");
    if (signals.activePackageCount > 0 && signals.remainingCredits <= 0) {
      reasons.push("Kalan ders hakkı bulunmuyor");
    }
    if (signals.daysSinceAttendance === null) reasons.push("Henüz katılım kaydı bulunmuyor");
    else if (signals.daysSinceAttendance > 14) reasons.push("Son katılım üzerinden 14 günden fazla süre geçti");
    if (signals.daysSinceMeasurement === null) reasons.push("Henüz ölçüm kaydı bulunmuyor");
    else if (signals.daysSinceMeasurement > 30) reasons.push("Son ölçüm üzerinden 30 günden fazla süre geçti");
    if (signals.approvedBookings30d === 0) reasons.push("Son 30 günde onaylı randevu bulunmuyor");
    return reasons;
  }

  private static computeForMember(
    member: User,
    signals: RiskSignals,
    latestRetention: LatestRetentionRow | null
  ): MemberRiskItem {
    const attendanceScore = RiskService.attendanceScore(signals.daysSinceAttendance);
    const packageScore = RiskService.packageScore(signals.activePackageCount, signals.remainingCredits);
    const measurementScore = RiskService.measurementScore(signals.daysSinceMeasurement);
    const engagementScore = RiskService.engagementScore(signals.approvedBookings30d);
    const referralScore = RiskService.referralScore(signals.convertedReferrals);

    let score = Math.round(
      attendanceScore * 0.3 +
      packageScore * 0.25 +
      measurementScore * 0.2 +
      engagementScore * 0.15 +
      referralScore * 0.1
    );
    if (!member.is_active) {
      score = Math.min(score, 30);
    }
    score = Math.max(0, Math.min(100, score));

    const level = RiskService.toLevel(score);
    const riskLabel = RiskService.toRiskLabel(level);
    const reasons = RiskService.buildReasons(member, signals);

    return {
      member_id: member.id,
      full_name: `${member.first_name} ${member.last_name}`.trim(),
      email: member.email,
      phone: member.phone,
      is_active: member.is_active,
      score,
      level,
      risk_label: riskLabel,
      calculated_at: new Date(),
      days_since_attendance: signals.daysSinceAttendance,
      days_since_measurement: signals.daysSinceMeasurement,
      active_package_count: signals.activePackageCount,
      remaining_credits: signals.remainingCredits,
      approved_bookings_30d: signals.approvedBookings30d,
      referrals_converted: signals.convertedReferrals,
      reasons,
      latest_saved_score: latestRetention?.score ?? null,
      latest_saved_at: latestRetention?.calculated_at ?? null,
      breakdown: {
        weights: {
          attendance: 0.3,
          package: 0.25,
          measurement: 0.2,
          engagement: 0.15,
          referral: 0.1,
        },
        sub_scores: {
          attendance: attendanceScore,
          package: packageScore,
          measurement: measurementScore,
          engagement: engagementScore,
          referral: referralScore,
        },
        signals: {
          days_since_attendance: signals.daysSinceAttendance,
          days_since_measurement: signals.daysSinceMeasurement,
          active_package_count: signals.activePackageCount,
          remaining_credits: signals.remainingCredits,
          approved_bookings_30d: signals.approvedBookings30d,
          referrals_converted: signals.convertedReferrals,
        },
        reasons,
      },
    };
  }

  private static async latestRetentionByMembers(tenantId: string, memberIds: string[]) {
    if (memberIds.length === 0) return new Map<string, LatestRetentionRow>();
    const rows = await AppDataSource.getRepository(RetentionScore)
      .createQueryBuilder("r")
      .distinctOn(["r.member_id"])
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.member_id IN (:...memberIds)", { memberIds })
      .orderBy("r.member_id", "ASC")
      .addOrderBy("r.calculated_at", "DESC")
      .getMany();

    return new Map<string, LatestRetentionRow>(
      rows.map((row) => [
        row.member_id,
        { score: row.score, calculated_at: row.calculated_at },
      ])
    );
  }

  private static async buildSignals(tenantId: string, memberIds: string[]) {
    const byMember = new Map<string, RiskSignals>();
    for (const memberId of memberIds) {
      byMember.set(memberId, {
        daysSinceAttendance: null,
        daysSinceMeasurement: null,
        activePackageCount: 0,
        remainingCredits: 0,
        approvedBookings30d: 0,
        convertedReferrals: 0,
      });
    }

    if (memberIds.length === 0) return byMember;

    const now = new Date();
    const since30 = new Date(Date.now() - 30 * DAY_MS);

    const latestAttendances = await AppDataSource.getRepository(Attendance)
      .createQueryBuilder("a")
      .distinctOn(["a.member_id"])
      .where("a.tenant_id = :tenantId", { tenantId })
      .andWhere("a.member_id IN (:...memberIds)", { memberIds })
      .orderBy("a.member_id", "ASC")
      .addOrderBy("a.created_at", "DESC")
      .getMany();
    for (const row of latestAttendances) {
      const cur = byMember.get(row.member_id);
      if (!cur) continue;
      cur.daysSinceAttendance = RiskService.daysSince(row.created_at);
    }

    const latestMeasurements = await AppDataSource.getRepository(Measurement)
      .createQueryBuilder("m")
      .distinctOn(["m.member_id"])
      .where("m.tenant_id = :tenantId", { tenantId })
      .andWhere("m.member_id IN (:...memberIds)", { memberIds })
      .orderBy("m.member_id", "ASC")
      .addOrderBy("m.measured_at", "DESC")
      .getMany();
    for (const row of latestMeasurements) {
      const cur = byMember.get(row.member_id);
      if (!cur) continue;
      cur.daysSinceMeasurement = RiskService.daysSince(row.measured_at);
    }

    const packageRows = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .select("up.user_id", "member_id")
      .addSelect("COUNT(*)::int", "active_package_count")
      .addSelect("COALESCE(SUM(up.remaining_credits), 0)::int", "remaining_credits")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id IN (:...memberIds)", { memberIds })
      .andWhere("up.is_active = true")
      .andWhere("(up.expires_at IS NULL OR up.expires_at > :now)", { now })
      .groupBy("up.user_id")
      .getRawMany<{ member_id: string; active_package_count: string; remaining_credits: string }>();
    for (const row of packageRows) {
      const cur = byMember.get(row.member_id);
      if (!cur) continue;
      cur.activePackageCount = Number(row.active_package_count) || 0;
      cur.remainingCredits = Number(row.remaining_credits) || 0;
    }

    const bookingRows = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .select("b.member_id", "member_id")
      .addSelect("COUNT(*)::int", "approved_booking_count_30d")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.member_id IN (:...memberIds)", { memberIds })
      .andWhere("b.status = :status", { status: BookingStatus.APPROVED })
      .andWhere("b.starts_at >= :since30", { since30 })
      .andWhere("b.starts_at <= :now", { now })
      .groupBy("b.member_id")
      .getRawMany<{ member_id: string; approved_booking_count_30d: string }>();
    for (const row of bookingRows) {
      const cur = byMember.get(row.member_id);
      if (!cur) continue;
      cur.approvedBookings30d = Number(row.approved_booking_count_30d) || 0;
    }

    const referralRows = await AppDataSource.getRepository(Referral)
      .createQueryBuilder("r")
      .select("r.inviter_member_id", "member_id")
      .addSelect("COUNT(*)::int", "converted_referrals")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.inviter_member_id IN (:...memberIds)", { memberIds })
      .andWhere("r.status IN (:...statuses)", {
        statuses: [ReferralStatus.CONVERTED, ReferralStatus.REWARDED],
      })
      .groupBy("r.inviter_member_id")
      .getRawMany<{ member_id: string; converted_referrals: string }>();
    for (const row of referralRows) {
      const cur = byMember.get(row.member_id);
      if (!cur) continue;
      cur.convertedReferrals = Number(row.converted_referrals) || 0;
    }

    return byMember;
  }

  static async listRiskMembers(params: {
    tenantId: string;
    memberIds?: string[];
    memberActivity?: MemberActivityFilter;
    riskSegment?: RiskSegment;
    onlyActive?: boolean;
    level?: RiskLevel;
    onlyAtRisk?: boolean;
    limit?: number;
  }) {
    const {
      tenantId,
      memberIds,
      memberActivity = "ALL",
      riskSegment,
      onlyActive = false,
      level,
      onlyAtRisk = false,
      limit,
    } = params;

    const qb = AppDataSource.getRepository(User)
      .createQueryBuilder("u")
      .where("u.tenant_id = :tenantId", { tenantId })
      .andWhere("u.role = :role", { role: UserRole.MEMBER })
      .orderBy("u.created_at", "DESC");

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      qb.andWhere("u.id IN (:...memberIds)", { memberIds });
    }

    const normalizedMemberActivity: MemberActivityFilter =
      onlyActive ? "ACTIVE" : memberActivity;

    if (normalizedMemberActivity === "ACTIVE") {
      qb.andWhere("u.is_active = true");
    }
    if (normalizedMemberActivity === "INACTIVE") {
      qb.andWhere("u.is_active = false");
    }

    const members = await qb.getMany();
    const scopedMemberIds = members.map((m) => m.id);
    const [signalsByMember, latestRetentionByMember] = await Promise.all([
      RiskService.buildSignals(tenantId, scopedMemberIds),
      RiskService.latestRetentionByMembers(tenantId, scopedMemberIds),
    ]);

    let rows = members.map((member) =>
      RiskService.computeForMember(
        member,
        signalsByMember.get(member.id) ?? {
          daysSinceAttendance: null,
          daysSinceMeasurement: null,
          activePackageCount: 0,
          remainingCredits: 0,
          approvedBookings30d: 0,
          convertedReferrals: 0,
        },
        latestRetentionByMember.get(member.id) ?? null
      )
    );

    rows = rows.sort((a, b) => a.score - b.score);
    const normalizedRiskSegment: RiskSegment =
      onlyAtRisk ? "AT_RISK" : (riskSegment ?? "ALL");

    if (normalizedRiskSegment === "AT_RISK") {
      rows = rows.filter((row) => row.level !== "LOW");
    }
    if (normalizedRiskSegment === "HEALTHY") {
      rows = rows.filter((row) => row.level === "LOW");
    }
    if (level) {
      rows = rows.filter((row) => row.level === level);
    }

    const normalizedLimit = RiskService.normalizeLimit(limit);
    const data = typeof normalizedLimit === "number" ? rows.slice(0, normalizedLimit) : rows;
    return {
      data,
      total: rows.length,
      limit: normalizedLimit ?? rows.length,
    };
  }

  static async getMemberRiskDetail(tenantId: string, memberId: string) {
    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) return null;

    const [signalsByMember, latestRetentionByMember] = await Promise.all([
      RiskService.buildSignals(tenantId, [memberId]),
      RiskService.latestRetentionByMembers(tenantId, [memberId]),
    ]);

    return RiskService.computeForMember(
      member,
      signalsByMember.get(member.id) ?? {
        daysSinceAttendance: null,
        daysSinceMeasurement: null,
        activePackageCount: 0,
        remainingCredits: 0,
        approvedBookings30d: 0,
        convertedReferrals: 0,
      },
      latestRetentionByMember.get(member.id) ?? null
    );
  }

  static async recalculate(params: { tenantId: string; memberId?: string }) {
    const { tenantId, memberId } = params;
    const where: { tenant_id: string; role: UserRole; id?: string } = {
      tenant_id: tenantId,
      role: UserRole.MEMBER,
    };
    if (memberId) where.id = memberId;

    const members = await AppDataSource.getRepository(User).find({
      where,
      order: { created_at: "DESC" },
    });
    if (members.length === 0) {
      return { processed: 0, saved: 0, data: [] as MemberRiskItem[] };
    }

    const memberIds = members.map((m) => m.id);
    const signalsByMember = await RiskService.buildSignals(tenantId, memberIds);
    const retentionRepo = AppDataSource.getRepository(RetentionScore);
    const now = new Date();

    const computed = members.map((member) =>
      RiskService.computeForMember(
        member,
        signalsByMember.get(member.id) ?? {
          daysSinceAttendance: null,
          daysSinceMeasurement: null,
          activePackageCount: 0,
          remainingCredits: 0,
          approvedBookings30d: 0,
          convertedReferrals: 0,
        },
        null
      )
    );

    const entities = computed.map((item) =>
      retentionRepo.create({
        tenant_id: tenantId,
        member_id: item.member_id,
        score: item.score,
        breakdown: item.breakdown,
        calculated_at: now,
      })
    );
    await retentionRepo.save(entities);

    return {
      processed: members.length,
      saved: entities.length,
      data: computed,
    };
  }
}
