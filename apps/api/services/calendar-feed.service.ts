import type {
  CalendarFeed,
  CalendarFeedApprovalStatus,
  CalendarFeedBadgeTone,
  CalendarFeedEvent,
  CalendarFeedRole,
} from "@fitnes-saas/contracts";
import { AppDataSource } from "../data-source";
import { Availability } from "../entities/availability.entity";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { ClassSession } from "../entities/class-session.entity";
import { NotificationEvent } from "../entities/notification-event.entity";
import { Package } from "../entities/package.entity";
import { SalonProfile } from "../entities/salon-profile.entity";
import { Tenant } from "../entities/tenant.entity";
import { User } from "../entities/user.entity";
import { AppError } from "../errors/AppError";
import { AvailabilityProjectionService } from "./availability-projection.service";
import { lessonCategoryLabel, packageDisplayName } from "./presentation-label.service";

const MAX_RANGE_MS = 26 * 7 * 24 * 60 * 60 * 1000;

type ScheduleChange = {
  request_id: string;
  proposed_starts_at: string;
  proposed_ends_at: string;
};

type BuildInput = {
  role: CalendarFeedRole;
  actorUserId: string;
  timezone: string;
  from: Date;
  to: Date;
  businessHours: CalendarFeed["business_hours"];
  bookings: Booking[];
  sessions: ClassSession[];
  availabilities: Availability[];
  pendingAvailabilitySlots: Array<Record<string, unknown>>;
  users: User[];
  packages: Package[];
  scheduleChanges: Map<string, ScheduleChange>;
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function iso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function isCanceled(status: unknown) {
  return ["CANCELED", "CANCELLED"].includes(String(status || "").toUpperCase());
}

function approvalStatus(status: unknown, scheduleChange?: ScheduleChange | null): CalendarFeedApprovalStatus {
  if (scheduleChange) return "PENDING";
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "REJECTED") return "REJECTED";
  if (["APPROVED", "RESCHEDULED", "SCHEDULED", "COMPLETED"].includes(normalized)) return "APPROVED";
  return "NONE";
}

function statusPresentation(status: unknown, scheduleChange?: ScheduleChange | null): { label: string; tone: CalendarFeedBadgeTone } {
  if (scheduleChange) return { label: "Saat Onayı Bekliyor", tone: "warning" };
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return { label: "Onay Bekliyor", tone: "warning" };
  if (normalized === "APPROVED") return { label: "Onaylandı", tone: "success" };
  if (normalized === "RESCHEDULED") return { label: "Yeniden Planlandı", tone: "info" };
  if (normalized === "COMPLETED") return { label: "Tamamlandı", tone: "success" };
  if (isCanceled(normalized)) return { label: "İptal Edildi", tone: "danger" };
  if (normalized === "SCHEDULED") return { label: "Planlandı", tone: "info" };
  return { label: normalized || "Planlandı", tone: "neutral" };
}

function overlaps(first: CalendarFeedEvent, second: CalendarFeedEvent) {
  return new Date(first.starts_at) < new Date(second.ends_at) && new Date(first.ends_at) > new Date(second.starts_at);
}

function withConflicts(events: CalendarFeedEvent[]) {
  const scheduleEvents = events.filter(
    (event) => !event.is_cancelled && (event.source === "BOOKING" || event.source === "GROUP_SESSION")
  );
  const conflictMap = new Map<string, Set<string>>();

  for (let firstIndex = 0; firstIndex < scheduleEvents.length; firstIndex += 1) {
    const first = scheduleEvents[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < scheduleEvents.length; secondIndex += 1) {
      const second = scheduleEvents[secondIndex];
      if (new Date(second.starts_at) >= new Date(first.ends_at)) break;
      if (!overlaps(first, second)) continue;
      if (first.details.session_id && first.details.session_id === second.details.session_id) continue;
      const sameTrainer = Boolean(first.details.trainer_id && first.details.trainer_id === second.details.trainer_id);
      const sameMember = Boolean(first.details.member_id && first.details.member_id === second.details.member_id);
      if (!sameTrainer && !sameMember) continue;
      const firstSet = conflictMap.get(first.id) ?? new Set<string>();
      const secondSet = conflictMap.get(second.id) ?? new Set<string>();
      firstSet.add(second.id);
      secondSet.add(first.id);
      conflictMap.set(first.id, firstSet);
      conflictMap.set(second.id, secondSet);
    }
  }

  return events.map((event) => {
    const eventIds = Array.from(conflictMap.get(event.id) ?? []).sort();
    return { ...event, conflict: { has_conflict: eventIds.length > 0, event_ids: eventIds } };
  });
}

export class CalendarFeedService {
  static parseRange(input: { from?: unknown; to?: unknown; timezone?: unknown }, now = new Date()) {
    const defaultFrom = new Date(now);
    defaultFrom.setUTCHours(0, 0, 0, 0);
    const from = input.from ? new Date(String(input.from)) : defaultFrom;
    const to = input.to ? new Date(String(input.to)) : new Date(from.getTime() + MAX_RANGE_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new AppError("CALENDAR_RANGE_INVALID", 422, "Takvim tarih aralığı geçersiz");
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new AppError("CALENDAR_RANGE_TOO_LARGE", 422, "Takvim aralığı en fazla 26 hafta olabilir");
    }
    const timezone = input.timezone ? String(input.timezone).trim() : null;
    if (timezone) {
      try {
        new Intl.DateTimeFormat("tr-TR", { timeZone: timezone }).format(from);
      } catch {
        throw new AppError("CALENDAR_TIMEZONE_INVALID", 422, "Geçerli bir IANA timezone gönderilmelidir");
      }
    }
    return { from, to, timezone };
  }

  static buildFeed(input: BuildInput): CalendarFeed {
    const userNameMap = new Map(input.users.map((user) => [user.id, `${user.first_name} ${user.last_name}`.trim()]));
    const packageMap = new Map(input.packages.map((pkg) => [pkg.id, pkg]));
    const sessionMap = new Map(input.sessions.map((session) => [session.id, session]));
    const visibleBookings = input.bookings.filter((booking) => {
      if (input.role === "TRAINER") return booking.trainer_id === input.actorUserId;
      if (input.role === "MEMBER") return booking.member_id === input.actorUserId;
      return true;
    });
    const visibleSessions = input.sessions.filter((session) => {
      if (input.role === "TRAINER") return session.trainer_id === input.actorUserId;
      return input.role === "ADMIN";
    });
    const sessionBookingMap = new Map<string, Booking[]>();
    for (const booking of visibleBookings) {
      if (!booking.session_id) continue;
      const rows = sessionBookingMap.get(booking.session_id) ?? [];
      rows.push(booking);
      sessionBookingMap.set(booking.session_id, rows);
    }
    const bookingSlotKeys = new Set<string>();
    const events: CalendarFeedEvent[] = [];

    for (const booking of visibleBookings) {
      const meta = objectValue(booking.meta);
      const session = booking.session_id ? sessionMap.get(booking.session_id) : undefined;
      const packageId = String(meta.package_id || session?.related_package_id || "") || null;
      const pkg = packageId ? packageMap.get(packageId) : undefined;
      const packageTitle = packageDisplayName(meta.package_title) || pkg?.title || null;
      const isDuo = Boolean(meta.is_duo || meta.duo);
      const scheduleChange = input.scheduleChanges.get(booking.id) ?? null;
      const memberName = userNameMap.get(booking.member_id) || null;
      const trainerName = userNameMap.get(booking.trainer_id) || null;
      const category = session?.lesson_category || String(meta.lesson_category || "") || null;
      const categoryLabel = isDuo ? "İkili ders" : lessonCategoryLabel(category);
      const isGroupClass = session?.type === "GROUP";
      const sessionBookings = session ? sessionBookingMap.get(session.id) ?? [] : [];
      const approvedSessionBookings = sessionBookings.filter((candidate) =>
        [BookingStatus.APPROVED, BookingStatus.RESCHEDULED].includes(candidate.status)
      );
      const presentation = statusPresentation(booking.status, scheduleChange);
      const title =
        isGroupClass
          ? session?.title || "Grup dersi"
          : input.role === "MEMBER"
          ? isDuo ? "Duo ders" : session?.title || categoryLabel || "Ders"
          : isDuo ? `Duo: ${memberName || "Danışan"}` : memberName || session?.title || "Ders";
      const subtitle =
        isGroupClass
          ? `${trainerName || "Eğitmen"} • ${session?.recurrence_label || "Özel tarih"} • ${approvedSessionBookings.length} katılım`
          : input.role === "MEMBER"
          ? `${trainerName || "Eğitmen"} • ${packageTitle || "Planlı seans"}`
          : `${trainerName || "Eğitmen"} • ${categoryLabel || packageTitle || "Seans"}`;
      bookingSlotKeys.add(`${booking.member_id}|${iso(booking.starts_at)}|${iso(booking.ends_at)}`);
      events.push({
        id: `booking:${booking.id}`,
        source: "BOOKING",
        entity_id: booking.id,
        starts_at: iso(booking.starts_at),
        ends_at: iso(booking.ends_at),
        timezone: input.timezone,
        status: booking.status,
        approval_status: approvalStatus(booking.status, scheduleChange),
        is_cancelled: isCanceled(booking.status),
        recurrence: { kind: "NONE", template_id: null, occurrence_starts_at: null },
        conflict: { has_conflict: false, event_ids: [] },
        presentation: { title, subtitle, badge_label: presentation.label, badge_tone: presentation.tone },
        details: {
          booking_id: booking.id,
          session_id: booking.session_id || null,
          member_id: booking.member_id,
          member_full_name: input.role === "MEMBER" ? null : memberName,
          trainer_id: booking.trainer_id,
          trainer_full_name: trainerName,
          package_id: packageId,
          package_title: packageTitle,
          session_title: session?.title || null,
          lesson_category: category,
          lesson_category_label: categoryLabel,
          is_group_class: isGroupClass,
          is_duo: isDuo,
          duo_partner_name: objectValue(meta.duo).partner_name || null,
          duo_status: objectValue(meta.duo).status || null,
          pending_schedule_change: scheduleChange,
          payment_status: booking.payment_status,
          checkin_status: booking.checkin_status,
          recurrence_label: session?.recurrence_label || null,
          capacity: session?.capacity || null,
          price: session?.price || null,
          notification_scope: session?.notification_scope || null,
          invited_member_count: session?.invited_member_count || 0,
          joined_member_count: sessionBookings.length,
          approved_member_count: approvedSessionBookings.length,
          participants: sessionBookings.map((candidate) => ({
            member_id: candidate.member_id,
            member_full_name: userNameMap.get(candidate.member_id) || "Salon üyesi",
            status: candidate.status,
          })),
        },
      });
    }

    const representedSessionIds = new Set(visibleBookings.map((booking) => booking.session_id).filter(Boolean));
    if (input.role !== "MEMBER") {
      for (const session of visibleSessions) {
        if (representedSessionIds.has(session.id)) continue;
        const presentation = statusPresentation(session.status);
        const trainerName = session.trainer_id ? userNameMap.get(session.trainer_id) || null : null;
        events.push({
          id: `session:${session.id}`,
          source: "GROUP_SESSION",
          entity_id: session.id,
          starts_at: iso(session.starts_at),
          ends_at: iso(session.ends_at),
          timezone: input.timezone,
          status: session.status,
          approval_status: approvalStatus(session.status),
          is_cancelled: isCanceled(session.status),
          recurrence: { kind: "NONE", template_id: null, occurrence_starts_at: null },
          conflict: { has_conflict: false, event_ids: [] },
          presentation: {
            title: session.title || "Grup dersi",
            subtitle: `${trainerName || "Eğitmen"} • ${session.recurrence_label || "Özel tarih"}`,
            badge_label: presentation.label,
            badge_tone: presentation.tone,
          },
          details: {
            session_id: session.id,
            trainer_id: session.trainer_id || null,
            trainer_full_name: trainerName,
            package_id: session.related_package_id || null,
            package_title: session.related_package_id ? packageMap.get(session.related_package_id)?.title || null : null,
            session_title: session.title,
            lesson_category: session.lesson_category,
            lesson_category_label: lessonCategoryLabel(session.lesson_category),
            is_group_class: true,
            recurrence_label: session.recurrence_label || null,
            capacity: session.capacity,
            price: session.price || null,
            notification_scope: session.notification_scope,
            invited_member_count: session.invited_member_count,
            joined_member_count: 0,
            approved_member_count: 0,
            planned_total_revenue: 0,
            trainer_planned_earning: 0,
          },
        });
      }
    }

    if (input.role === "MEMBER") {
      const projected = AvailabilityProjectionService.projectWeeklyRange(
        input.availabilities.filter((row) => row.member_id === input.actorUserId),
        input.from,
        input.to
      );
      for (const row of projected) {
        const startsAt = iso(row.starts_at);
        const endsAt = iso(row.ends_at);
        if (bookingSlotKeys.has(`${row.member_id}|${startsAt}|${endsAt}`)) continue;
        const packageTitle = row.package_id ? packageMap.get(row.package_id)?.title || null : null;
        events.push({
          id: `availability:${row.id}`,
          source: "AVAILABILITY",
          entity_id: row.id,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone: input.timezone,
          status: "APPROVED",
          approval_status: "APPROVED",
          is_cancelled: false,
          recurrence: {
            kind: "WEEKLY",
            template_id: row.id.split(":")[0] || row.id,
            occurrence_starts_at: startsAt,
          },
          conflict: { has_conflict: false, event_ids: [] },
          presentation: {
            title: packageTitle || "Onaylı saat tercihin",
            subtitle: "Salon tarafından kaydedilen haftalık uygunluk",
            badge_label: "Onaylandı",
            badge_tone: "info",
          },
          details: { member_id: row.member_id, package_id: row.package_id || null, package_title: packageTitle, note: row.note || null },
        });
      }

      input.pendingAvailabilitySlots.forEach((slot, index) => {
        const startsAtDate = new Date(String(slot.starts_at || ""));
        const endsAtDate = new Date(String(slot.ends_at || ""));
        if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) return;
        if (startsAtDate >= input.to || endsAtDate <= input.from) return;
        const startsAt = startsAtDate.toISOString();
        const endsAt = endsAtDate.toISOString();
        if (bookingSlotKeys.has(`${input.actorUserId}|${startsAt}|${endsAt}`)) return;
        const entityId = String(slot.id || `${index}-${startsAt}`);
        events.push({
          id: `pending-availability:${entityId}`,
          source: "PENDING_AVAILABILITY",
          entity_id: entityId,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone: input.timezone,
          status: "PENDING",
          approval_status: "PENDING",
          is_cancelled: false,
          recurrence: { kind: "NONE", template_id: null, occurrence_starts_at: null },
          conflict: { has_conflict: false, event_ids: [] },
          presentation: {
            title: String(slot.label || "Saat tercihin"),
            subtitle: "Salon onayı bekleniyor",
            badge_label: "Onay Bekliyor",
            badge_tone: "warning",
          },
          details: {
            member_id: input.actorUserId,
            package_id: slot.package_id ? String(slot.package_id) : null,
            package_title: slot.package_title ? String(slot.package_title) : null,
          },
        });
      });
    }

    const sorted = events.sort((first, second) => {
      const timeDiff = new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime();
      return timeDiff || first.id.localeCompare(second.id);
    });
    return {
      role: input.role,
      timezone: input.timezone,
      range: { from: input.from.toISOString(), to: input.to.toISOString() },
      business_hours: input.businessHours,
      events: withConflicts(sorted),
    };
  }

  static async getFeed(input: {
    tenantId: string;
    role: CalendarFeedRole;
    actorUserId: string;
    from: Date;
    to: Date;
    timezone?: string | null;
  }) {
    const bookingQuery = AppDataSource.getRepository(Booking)
      .createQueryBuilder("booking")
      .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
      .andWhere("booking.starts_at < :to", { to: input.to })
      .andWhere("booking.ends_at > :from", { from: input.from });
    if (input.role === "TRAINER") bookingQuery.andWhere("booking.trainer_id = :actorUserId", { actorUserId: input.actorUserId });
    if (input.role === "MEMBER") bookingQuery.andWhere("booking.member_id = :actorUserId", { actorUserId: input.actorUserId });

    const sessionQuery = AppDataSource.getRepository(ClassSession)
      .createQueryBuilder("session")
      .where("session.tenant_id = :tenantId", { tenantId: input.tenantId })
      .andWhere("session.starts_at < :to", { to: input.to })
      .andWhere("session.ends_at > :from", { from: input.from });
    if (input.role === "TRAINER") sessionQuery.andWhere("session.trainer_id = :actorUserId", { actorUserId: input.actorUserId });
    if (input.role === "MEMBER") sessionQuery.andWhere("1 = 0");

    const [bookings, rangeSessions, profile, tenant] = await Promise.all([
      bookingQuery.getMany(),
      sessionQuery.getMany(),
      AppDataSource.getRepository(SalonProfile).findOne({ where: { tenant_id: input.tenantId } }),
      AppDataSource.getRepository(Tenant).findOne({ where: { id: input.tenantId }, select: ["id", "timezone"] }),
    ]);

    const linkedSessionIds = Array.from(new Set(bookings.map((booking) => booking.session_id).filter(Boolean))) as string[];
    const missingSessionIds = linkedSessionIds.filter((id) => !rangeSessions.some((session) => session.id === id));
    const linkedSessions = missingSessionIds.length
      ? await AppDataSource.getRepository(ClassSession).find({ where: missingSessionIds.map((id) => ({ id, tenant_id: input.tenantId })) })
      : [];
    const sessions = [...rangeSessions, ...linkedSessions];
    const timezone = input.timezone || tenant?.timezone || profile?.business_hours?.timezone || "Europe/Istanbul";

    const userIds = Array.from(new Set(bookings.flatMap((booking) => [booking.member_id, booking.trainer_id]).concat(sessions.map((session) => session.trainer_id || "")).filter(Boolean)));
    const packageIds = Array.from(new Set([
      ...bookings.map((booking) => String(objectValue(booking.meta).package_id || "")),
      ...sessions.map((session) => session.related_package_id || ""),
    ].filter(Boolean)));
    const bookingIds = new Set(bookings.map((booking) => booking.id));

    const [users, packages, scheduleRows, availabilities, pendingPaymentRows] = await Promise.all([
      userIds.length ? AppDataSource.getRepository(User).find({ where: userIds.map((id) => ({ id, tenant_id: input.tenantId })) }) : Promise.resolve([]),
      packageIds.length ? AppDataSource.getRepository(Package).find({ where: packageIds.map((id) => ({ id, tenant_id: input.tenantId })) }) : Promise.resolve([]),
      bookingIds.size
        ? AppDataSource.getRepository(NotificationEvent).find({ where: { tenant_id: input.tenantId, type: "TRAINER_SCHEDULE_CHANGE_REQUEST" } as any, order: { created_at: "DESC" } })
        : Promise.resolve([]),
      input.role === "MEMBER"
        ? AppDataSource.getRepository(Availability).find({ where: { tenant_id: input.tenantId, member_id: input.actorUserId } })
        : Promise.resolve([]),
      input.role === "MEMBER"
        ? AppDataSource.getRepository(NotificationEvent).find({ where: { tenant_id: input.tenantId, member_id: input.actorUserId, type: "MEMBER_PAYMENT_REQUEST" } as any, order: { created_at: "DESC" }, take: 20 })
        : Promise.resolve([]),
    ]);

    const scheduleChanges = new Map<string, ScheduleChange>();
    for (const row of scheduleRows) {
      const payload = objectValue(row.payload);
      const bookingId = String(payload.booking_id || "");
      if (!bookingIds.has(bookingId) || String(payload.status || "PENDING") !== "PENDING" || scheduleChanges.has(bookingId)) continue;
      const proposedStart = new Date(String(payload.proposed_starts_at || ""));
      const proposedEnd = new Date(String(payload.proposed_ends_at || ""));
      if (Number.isNaN(proposedStart.getTime()) || Number.isNaN(proposedEnd.getTime())) continue;
      scheduleChanges.set(bookingId, {
        request_id: row.id,
        proposed_starts_at: proposedStart.toISOString(),
        proposed_ends_at: proposedEnd.toISOString(),
      });
    }

    const pendingPayment = pendingPaymentRows.find((row) => String(objectValue(row.payload).status || "PENDING") === "PENDING");
    const pendingSlots = pendingPayment && Array.isArray(objectValue(pendingPayment.payload).selected_days)
      ? objectValue(pendingPayment.payload).selected_days as Array<Record<string, unknown>>
      : [];

    return CalendarFeedService.buildFeed({
      role: input.role,
      actorUserId: input.actorUserId,
      timezone,
      from: input.from,
      to: input.to,
      businessHours: profile?.business_hours || null,
      bookings,
      sessions,
      availabilities,
      pendingAvailabilitySlots: pendingSlots,
      users,
      packages,
      scheduleChanges,
    });
  }
}
