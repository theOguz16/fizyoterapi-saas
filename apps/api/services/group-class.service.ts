import { AppDataSource } from "../data-source";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { ClassSession, GroupClassNotificationScope, SessionStatus, SessionType } from "../entities/class-session.entity";
import { Package } from "../entities/package.entity";
import { SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { User, UserRole } from "../entities/user.entity";
import { MobileNotificationService } from "./mobile-notification.service";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

type GroupSessionWithCounts = ClassSession & {
  joined_member_count?: number;
  approved_member_count?: number;
  trainer_commission_rate?: number | null;
  planned_total_revenue?: number | null;
  trainer_planned_earning?: number | null;
};

export class GroupClassService {
  static async getJoinedCountsBySessionIds(tenantId: string, sessionIds: string[]) {
    if (sessionIds.length === 0) return new Map<string, { joined: number; approved: number }>();
    const rows = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .select("b.session_id", "session_id")
      .addSelect("COUNT(*)::int", "joined_count")
      .addSelect(
        "SUM(CASE WHEN b.status = :approvedStatus THEN 1 ELSE 0 END)::int",
        "approved_count"
      )
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.session_id IN (:...sessionIds)", { sessionIds })
      .andWhere("b.status IN (:...statuses)", { statuses: ACTIVE_BOOKING_STATUSES })
      .setParameter("approvedStatus", BookingStatus.APPROVED)
      .groupBy("b.session_id")
      .getRawMany<{ session_id: string; joined_count: string; approved_count: string }>();

    return new Map(
      rows.map((row) => [
        row.session_id,
        {
          joined: Number(row.joined_count) || 0,
          approved: Number(row.approved_count) || 0,
        },
      ])
    );
  }

  static serialize(
    session: GroupSessionWithCounts,
    extras?: {
      trainer_full_name?: string | null;
      package_title?: string | null;
    }
  ) {
    const invitedMemberIds = Array.isArray(session.meta?.invited_member_ids)
      ? (session.meta.invited_member_ids as unknown[]).map((item) => String(item)).filter(Boolean)
      : [];

    return {
      ...session,
      is_group_class: session.type === SessionType.GROUP,
      lesson_name: session.title,
      group_class_id: session.id,
      joined_member_count: Number(session.joined_member_count || 0),
      approved_member_count: Number(session.approved_member_count || 0),
      planned_total_revenue: session.planned_total_revenue ?? null,
      trainer_commission_rate: session.trainer_commission_rate ?? null,
      trainer_planned_earning: session.trainer_planned_earning ?? null,
      invited_member_ids: invitedMemberIds,
      invited_member_count:
        Number(session.invited_member_count || 0) || invitedMemberIds.length,
      trainer_can_invite_members: true,
      trainer_full_name: extras?.trainer_full_name || null,
      package_title: extras?.package_title || null,
      package_name: extras?.package_title || null,
      price: session.price ?? null,
      notification_scope: session.notification_scope || GroupClassNotificationScope.SALON_MEMBERS,
      requires_admin_approval: session.requires_admin_approval ?? true,
      recurrence_label: session.recurrence_label ?? null,
      special_date: session.special_date ?? null,
    };
  }

  static async attachCounts(tenantId: string, sessions: ClassSession[]) {
    const countMap = await GroupClassService.getJoinedCountsBySessionIds(
      tenantId,
      sessions.map((session) => session.id)
    );
    const trainerIds = Array.from(new Set(sessions.map((session) => session.trainer_id).filter(Boolean))) as string[];
    const packageIds = Array.from(new Set(sessions.map((session) => session.related_package_id).filter(Boolean))) as string[];
    const [trainers, packages] = await Promise.all([
      trainerIds.length
        ? AppDataSource.getRepository(User).find({
            where: trainerIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.TRAINER })) as any,
            select: ["id", "first_name", "last_name"],
          })
        : Promise.resolve([]),
      packageIds.length
        ? AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id })) as any,
            select: ["id", "title", "rules"],
          })
        : Promise.resolve([]),
    ]);
    const trainerMap = new Map(trainers.map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()]));
    const packageMap = new Map(packages.map((row) => [row.id, row.title]));
    const packageCommissionMap = new Map(
      packages.map((row) => {
        const rules =
          row.rules && typeof row.rules === "object" && !Array.isArray(row.rules)
            ? (row.rules as Record<string, unknown>)
            : {};
        const commissionRateValue = Number(rules.trainer_commission_rate);
        return [row.id, Number.isFinite(commissionRateValue) ? commissionRateValue : 25];
      })
    );

    return sessions.map((session) => {
      const counts = countMap.get(session.id);
      const plannedTotalRevenue =
        session.price === null || session.price === undefined
          ? null
          : Number(session.price) * Number(session.capacity || 0);
      const trainerCommissionRate = session.related_package_id
        ? packageCommissionMap.get(session.related_package_id) ?? 25
        : 25;
      return GroupClassService.serialize({
        ...session,
        joined_member_count: counts?.joined || 0,
        approved_member_count: counts?.approved || 0,
        planned_total_revenue: plannedTotalRevenue,
        trainer_commission_rate: trainerCommissionRate,
        trainer_planned_earning:
          plannedTotalRevenue === null ? null : plannedTotalRevenue * (trainerCommissionRate / 100),
      }, {
        trainer_full_name: session.trainer_id ? trainerMap.get(session.trainer_id) || null : null,
        package_title: session.related_package_id ? packageMap.get(session.related_package_id) || null : null,
      });
    });
  }

  static async listTenantMemberIds(tenantId: string, invitedMemberIds?: string[]) {
    if (Array.isArray(invitedMemberIds) && invitedMemberIds.length > 0) {
      return Array.from(new Set(invitedMemberIds.map((row) => String(row)).filter(Boolean)));
    }

    const rows = await AppDataSource.getRepository(SalonMembership).find({
      where: {
        tenant_id: tenantId,
        role: "MEMBER" as any,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      },
      select: ["user_id"],
    });

    return Array.from(
      new Set(rows.map((row) => String(row.user_id || "")).filter(Boolean))
    );
  }

  static async listTenantAdminIds(tenantId: string) {
    const rows = await AppDataSource.getRepository(User).find({
      where: {
        tenant_id: tenantId,
        role: UserRole.ADMIN,
        is_active: true,
      },
      select: ["id"],
    });

    return Array.from(new Set(rows.map((row) => String(row.id || "")).filter(Boolean)));
  }

  static async notifySessionPublished(session: ClassSession) {
    if (session.type !== SessionType.GROUP || session.status !== SessionStatus.SCHEDULED) return;

    const invitedMemberIds = Array.isArray(session.meta?.invited_member_ids)
      ? (session.meta.invited_member_ids as unknown[]).map((item) => String(item)).filter(Boolean)
      : [];
    const isInviteOnly = session.notification_scope === GroupClassNotificationScope.INVITED_MEMBERS;
    const memberIds = await GroupClassService.listTenantMemberIds(
      session.tenant_id,
      isInviteOnly ? invitedMemberIds : undefined
    );
    const adminIds = await GroupClassService.listTenantAdminIds(session.tenant_id);

    await Promise.all(
      [
        ...memberIds.map((memberId) =>
          MobileNotificationService.queuePush({
            tenantId: session.tenant_id,
            userId: memberId,
            roleScope: "MEMBER",
            type: isInviteOnly ? "GROUP_CLASS_INVITED" : "GROUP_CLASS_PUBLISHED",
            title: isInviteOnly ? `${session.title} daveti` : `${session.title} acildi`,
            body: isInviteOnly
              ? `${session.title} grup dersine davet edildin. Kontenjan ve ucret bilgisi uygulamada hazir.`
              : `${session.title} icin yeni grup dersi acildi. Uygunsa katilim talebini gonderebilirsin.`,
            deepLink: "/(member)/home",
            meta: {
              session_id: session.id,
              starts_at: session.starts_at.toISOString(),
              ends_at: session.ends_at.toISOString(),
              price: session.price ?? null,
              notification_scope: session.notification_scope,
              screen: "CALENDAR",
            },
          })
        ),
        ...adminIds.map((adminId) =>
          MobileNotificationService.queuePush({
            tenantId: session.tenant_id,
            userId: adminId,
            roleScope: "ADMIN",
            type: "GROUP_CLASS_PUBLISHED",
            title: `${session.title} icin yeni plan`,
            body: `${session.title} grup dersi takvime eklendi. Ucret ve operasyon detaylarini gozden gecirebilirsin.`,
            deepLink: "/(admin)/calendar",
            meta: {
              session_id: session.id,
              starts_at: session.starts_at.toISOString(),
              ends_at: session.ends_at.toISOString(),
              price: session.price ?? null,
              notification_scope: session.notification_scope,
              requires_admin_approval: session.requires_admin_approval,
              screen: "CALENDAR",
            },
          })
        ),
      ]
    );
  }
}
