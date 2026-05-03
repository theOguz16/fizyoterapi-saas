import { Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Booking, BookingPaymentStatus, BookingStatus } from "../../entities/booking.entity";
import { ClassSession, GroupClassNotificationScope, SessionStatus, SessionType } from "../../entities/class-session.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { Package } from "../../entities/package.entity";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { GroupClassService } from "../../services/group-class.service";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED];

function readEventOwnerId(req: AuthenticatedRequest) {
  return req.auth?.linkedUserId || req.auth?.accountId || req.auth?.sub || "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function isSessionVisibleToMember(session: ClassSession, memberId: string) {
  if (session.notification_scope !== GroupClassNotificationScope.INVITED_MEMBERS) return true;
  const invitedIds = asStringArray(session.meta?.invited_member_ids);
  return invitedIds.includes(memberId);
}

function buildSelectedDayRow(session: ClassSession, packageRow?: Package | null, joinedCount?: number) {
  return {
    starts_at: session.starts_at.toISOString(),
    ends_at: session.ends_at.toISOString(),
    label: session.title,
    package_id: session.related_package_id || null,
    package_title: packageRow?.title || null,
    lesson_name: session.title,
    group_class_id: session.id,
    group_title: session.title,
    is_group_class: true,
    is_recurring: Boolean(session.recurrence_label),
    recurrence_label: session.recurrence_label || null,
    special_date: session.special_date || null,
    price: session.price ?? null,
    capacity: session.capacity || 0,
    joined_count: Number(joinedCount || 0),
    notification_scope: session.notification_scope,
    requires_admin_approval: session.requires_admin_approval ?? true,
  };
}

export class MemberGroupClassesController {
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const eventOwnerId = readEventOwnerId(req);
      if (!tenantId || !memberId || !eventOwnerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const now = new Date();
      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
          where: {
            tenant_id: tenantId,
            user_id: memberId,
            role: "MEMBER" as any,
            status: SalonMembershipStatus.ACTIVE,
            is_active_context: true,
          },
        });

      if (!membership) {
        return res.json({ data: [] });
      }

      const sessionRepo = AppDataSource.getRepository(ClassSession);
      const sessions = await sessionRepo
        .createQueryBuilder("session")
        .where("session.tenant_id = :tenantId", { tenantId })
        .andWhere("session.type = :type", { type: SessionType.GROUP })
        .andWhere("session.status = :status", { status: SessionStatus.SCHEDULED })
        .andWhere("session.starts_at >= :now", { now })
        .orderBy("session.starts_at", "ASC")
        .getMany();
      const visibleSessions = sessions.filter((session) => isSessionVisibleToMember(session, memberId));
      if (visibleSessions.length === 0) {
        return res.json({ data: [] });
      }

      const sessionIds = visibleSessions.map((row) => row.id);
      const packageIds = Array.from(new Set(visibleSessions.map((row) => String(row.related_package_id || "")).filter(Boolean)));
      const [serializedRows, existingBookings, pendingEvents, packageRows] = await Promise.all([
        GroupClassService.attachCounts(tenantId, visibleSessions),
        AppDataSource.getRepository(Booking).find({
          where: {
            tenant_id: tenantId,
            member_id: memberId,
            session_id: In(sessionIds),
            status: In(ACTIVE_BOOKING_STATUSES),
          } as any,
        }),
        AppDataSource.getRepository(NotificationEvent).find({
          where: {
            tenant_id: tenantId,
            member_id: eventOwnerId,
            type: MEMBER_PAYMENT_REQUEST,
            status: NotificationEventStatus.QUEUED,
          } as any,
          order: { created_at: "DESC" },
        }),
        packageIds.length
          ? AppDataSource.getRepository(Package).find({
              where: packageIds.map((id) => ({ tenant_id: tenantId, id, is_active: true })) as any,
            })
          : Promise.resolve([]),
      ]);

      const packageMap = new Map(packageRows.map((row) => [row.id, row]));
      const bookingMap = new Map(existingBookings.map((row) => [String(row.session_id || ""), row]));
      const eventMap = new Map<string, NotificationEvent>();
      for (const row of pendingEvents) {
        // GÜVENLİK: Eğer DB'den string geliyorsa JSON'a çevir, objeyse direkt kullan
        const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {});
        
        const requestType = String(payload.request_type || "").toUpperCase();
        const selectedDays = Array.isArray(payload.selected_days) ? payload.selected_days : [];
        const firstGroupClassId = String((selectedDays[0] as any)?.group_class_id || "");
        
        if (requestType === "GROUP_CLASS_JOIN" && firstGroupClassId && !eventMap.has(firstGroupClassId)) {
          eventMap.set(firstGroupClassId, row);
        }
      }

      return res.json({
        data: serializedRows.map((row: any) => {
          const booking = bookingMap.get(String(row.id));
          const pendingEvent = eventMap.get(String(row.id));
          const memberJoinState = booking
            ? String(booking.status || "").toUpperCase() === "APPROVED"
              ? "JOINED"
              : "PENDING"
            : pendingEvent
              ? "PENDING"
              : "OPEN";

          return {
            ...row,
            package_title: row.related_package_id ? packageMap.get(String(row.related_package_id))?.title || row.package_title || null : row.package_title || null,
            member_join_state: memberJoinState,
            member_booking_id: booking?.id || null,
            member_join_request_id: pendingEvent?.id || null,
            member_can_leave: memberJoinState !== "OPEN",
          };
        }),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member group classes list error:", error);
      throw new AppError("MEMBER_GROUP_CLASSES_LIST_ERROR", 500, "Grup dersleri getirilemedi");
    }
  }

  static async join(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const accountId = req.auth?.accountId || null;
      const eventOwnerId = readEventOwnerId(req);
      const sessionId = String(req.params.id || "").trim();
      if (!tenantId || !memberId || !eventOwnerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      if (!sessionId) {
        throw new AppError("VALIDATION_ERROR", 400, "Grup dersi kimliği zorunludur");
      }

      const sessionRepo = AppDataSource.getRepository(ClassSession);
      const session = await sessionRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: sessionId,
          type: SessionType.GROUP,
          status: SessionStatus.SCHEDULED,
        },
      });
      if (!session) {
        throw new AppError("GROUP_CLASS_NOT_FOUND", 404, "Grup dersi bulunamadi");
      }
      if (!isSessionVisibleToMember(session, memberId)) {
        throw new AppError("GROUP_CLASS_NOT_VISIBLE", 403, "Bu grup dersi sana acik degil");
      }
      if (session.starts_at.getTime() <= Date.now()) {
        throw new AppError("GROUP_CLASS_STARTED", 409, "Baslamis bir grup dersine katilim talebi gonderilemez");
      }

      const [membership, packageRow, existingBooking, pendingRequest, countsMap] = await Promise.all([
        AppDataSource.getRepository(SalonMembership).findOne({
          where: {
            tenant_id: tenantId,
            user_id: memberId,
            role: "MEMBER" as any,
            status: SalonMembershipStatus.ACTIVE,
            is_active_context: true,
          },
        }),
        session.related_package_id
          ? AppDataSource.getRepository(Package).findOne({
              where: { tenant_id: tenantId, id: session.related_package_id, is_active: true },
            })
          : Promise.resolve(null),
        AppDataSource.getRepository(Booking).findOne({
          where: {
            tenant_id: tenantId,
            member_id: memberId,
            session_id: session.id,
            status: In(ACTIVE_BOOKING_STATUSES),
          } as any,
        }),
        AppDataSource.getRepository(NotificationEvent).findOne({
          where: {
            tenant_id: tenantId,
            member_id: eventOwnerId,
            type: MEMBER_PAYMENT_REQUEST,
            status: NotificationEventStatus.QUEUED,
          } as any,
          order: { created_at: "DESC" },
        }),
        GroupClassService.getJoinedCountsBySessionIds(tenantId, [session.id]),
      ]);

      if (!membership) {
        throw new AppError("MEMBERSHIP_NOT_FOUND", 409, "Aktif uyelik bulunamadi");
      }
      if (!session.related_package_id || !packageRow) {
        throw new AppError("GROUP_CLASS_PACKAGE_REQUIRED", 409, "Bu grup dersi icin bagli paket bulunamadi");
      }
      if (existingBooking) {
        throw new AppError("GROUP_CLASS_ALREADY_JOINED", 409, "Bu grup dersi icin zaten kaydin var");
      }

      const pendingRequestSessionId = String(((Array.isArray(pendingRequest?.payload?.selected_days) ? pendingRequest?.payload?.selected_days : [])[0] as any)?.group_class_id || "");
      if (String(pendingRequest?.payload?.request_type || "").toUpperCase() === "GROUP_CLASS_JOIN" && pendingRequestSessionId === session.id) {
        throw new AppError("GROUP_CLASS_REQUEST_EXISTS", 409, "Bu grup dersi icin zaten bekleyen talebin var");
      }

      const counts = countsMap.get(session.id) || { joined: 0, approved: 0 };
      if (session.capacity > 0 && counts.joined >= session.capacity) {
        throw new AppError("GROUP_CLASS_FULL", 409, "Bu grup dersinde bos kontenjan kalmadi");
      }

      const payload = {
        account_id: accountId,
        member_user_id: memberId,
        active_membership_id: membership.id,
        request_scope: "ACTIVE_MEMBERSHIP",
        tenant_id: tenantId,
        package_id: session.related_package_id,
        package_ids: [session.related_package_id],
        package_title: packageRow.title,
        selected_packages: [
          {
            package_id: session.related_package_id,
            package_title: packageRow.title,
            package_price: session.price ? Number(session.price) : packageRow.display_price ? Number(packageRow.display_price) : null,
          },
        ],
        amount: session.price ? Number(session.price) : packageRow.display_price ? Number(packageRow.display_price) : 0,
        trainer_id: session.trainer_id || null,
        selected_sub_lesson: session.title,
        selected_days: [buildSelectedDayRow(session, packageRow, counts.joined)],
        requested_price: session.price ? Number(session.price) : packageRow.display_price ? Number(packageRow.display_price) : null,
        notification_scope: session.notification_scope,
        invited_member_count: session.invited_member_count || 0,
        joined_member_count: counts.joined,
        request_type: "GROUP_CLASS_JOIN",
        note: "Member group class join",
        submitted_at: new Date().toISOString(),
        status: "PENDING",
      };

      const event = AppDataSource.getRepository(NotificationEvent).create({
        tenant_id: tenantId,
        member_id: eventOwnerId,
        type: MEMBER_PAYMENT_REQUEST,
        status: NotificationEventStatus.QUEUED,
        payload,
      });
      await AppDataSource.getRepository(NotificationEvent).save(event);

      return res.status(201).json({
        data: {
          id: event.id,
          status: "PENDING",
          session_id: session.id,
          request_type: "GROUP_CLASS_JOIN",
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member group class join error:", error);
      throw new AppError("MEMBER_GROUP_CLASS_JOIN_ERROR", 500, "Grup dersi katilim talebi gonderilemedi");
    }
  }

  static async leave(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const eventOwnerId = readEventOwnerId(req);
      const sessionId = String(req.params.id || "").trim();
      if (!tenantId || !memberId || !eventOwnerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      if (!sessionId) {
        throw new AppError("VALIDATION_ERROR", 400, "Grup dersi kimliği zorunludur");
      }

      const [bookings, pendingEvents] = await Promise.all([
        AppDataSource.getRepository(Booking).find({
          where: {
            tenant_id: tenantId,
            member_id: memberId,
            session_id: sessionId,
            status: In(ACTIVE_BOOKING_STATUSES),
          } as any,
        }),
        AppDataSource.getRepository(NotificationEvent).find({
          where: {
            tenant_id: tenantId,
            member_id: eventOwnerId,
            type: MEMBER_PAYMENT_REQUEST,
            status: NotificationEventStatus.QUEUED,
          } as any,
        }),
      ]);

      const removableEvents = pendingEvents.filter((row) => {
        const requestType = String(row.payload?.request_type || "").toUpperCase();
        const selectedDays = Array.isArray(row.payload?.selected_days) ? row.payload.selected_days : [];
        return requestType === "GROUP_CLASS_JOIN" && String((selectedDays[0] as any)?.group_class_id || "") === sessionId;
      });

      for (const booking of bookings) {
        booking.status = BookingStatus.CANCELED;
        booking.payment_status = BookingPaymentStatus.REJECTED;
        booking.payment_note = "Member group class leave";
        booking.meta = {
          ...(booking.meta || {}),
          cancellation: {
            canceled_by: "MEMBER",
            canceled_at: new Date().toISOString(),
            source: "MEMBER_GROUP_CLASS_LEAVE",
          },
        };
      }

      for (const event of removableEvents) {
        event.status = NotificationEventStatus.PROCESSED;
        event.processed_at = new Date();
        event.payload = {
          ...(event.payload || {}),
          decision: "CANCELED",
          status: "CANCELED",
        };
      }

      await Promise.all([
        bookings.length ? AppDataSource.getRepository(Booking).save(bookings) : Promise.resolve(),
        removableEvents.length ? AppDataSource.getRepository(NotificationEvent).save(removableEvents) : Promise.resolve(),
      ]);

      return res.json({
        data: {
          removed: bookings.length > 0 || removableEvents.length > 0,
          canceled_booking_count: bookings.length,
          canceled_request_count: removableEvents.length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member group class leave error:", error);
      throw new AppError("MEMBER_GROUP_CLASS_LEAVE_ERROR", 500, "Grup dersi katilimi kaldirilamadi");
    }
  }
}
