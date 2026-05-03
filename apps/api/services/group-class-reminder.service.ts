import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { ClassSession, SessionStatus, SessionType } from "../entities/class-session.entity";
import { Tenant } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { JobLockService } from "./job-lock.service";
import { MobileNotificationService } from "./mobile-notification.service";

const ACTIVE_ATTENDEE_STATUSES = [BookingStatus.APPROVED, BookingStatus.RESCHEDULED];
const DEFAULT_REMINDER_HOURS = [24, 3, 1];
const DEFAULT_TOLERANCE_MINUTES = 20;

function parseReminderHours() {
  const raw = String(process.env.GROUP_CLASS_REMINDER_HOURS || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return raw.length > 0 ? Array.from(new Set(raw)).sort((a, b) => b - a) : DEFAULT_REMINDER_HOURS;
}

function parseToleranceMinutes() {
  const raw = Number(process.env.GROUP_CLASS_REMINDER_TOLERANCE_MINUTES || DEFAULT_TOLERANCE_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TOLERANCE_MINUTES;
}

export class GroupClassReminderService {
  static async triggerAllTenants() {
    const hours = parseReminderHours();
    const toleranceMinutes = parseToleranceMinutes();

    return JobLockService.withAdvisoryLock(AppDataSource, "group-class-reminder-batch", async () => {
      const tenants = await AppDataSource.getRepository(Tenant).find({
        where: { is_active: true },
        select: ["id", "slug"],
      });

      for (const tenant of tenants) {
        await GroupClassReminderService.triggerTenant(tenant.id, hours, toleranceMinutes);
      }

      return { tenantCount: tenants.length };
    });
  }

  static async triggerTenant(tenantId: string, reminderHours = parseReminderHours(), toleranceMinutes = parseToleranceMinutes()) {
    const sessionRepo = AppDataSource.getRepository(ClassSession);
    const userRepo = AppDataSource.getRepository(User);
    const now = new Date();

    for (const hour of reminderHours) {
      const alreadySentKey = `group_class_reminder_${hour}h_sent_at`;
      const windowStart = new Date(now.getTime() + hour * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + toleranceMinutes * 60 * 1000);

      const sessions = await sessionRepo.find({
        where: {
          tenant_id: tenantId,
          type: SessionType.GROUP,
          status: SessionStatus.SCHEDULED,
        },
      });

      const candidateSessions = sessions.filter((session) => {
        const meta = (session.meta || {}) as Record<string, unknown>;
        if (meta[alreadySentKey]) return false;
        const startsAt = new Date(session.starts_at);
        return startsAt >= windowStart && startsAt <= windowEnd;
      });

      if (candidateSessions.length === 0) continue;

      const attendeeRows = await AppDataSource.getRepository(Booking).find({
        where: {
          tenant_id: tenantId,
          session_id: In(candidateSessions.map((session) => session.id)),
          status: In(ACTIVE_ATTENDEE_STATUSES),
        } as any,
        select: ["session_id", "member_id"],
      });

      const adminRows = await userRepo.find({
        where: {
          tenant_id: tenantId,
          role: UserRole.ADMIN,
          is_active: true,
        },
        select: ["id"],
      });

      const adminIds = adminRows.map((row) => row.id);
      const attendeesBySession = new Map<string, string[]>();
      for (const row of attendeeRows) {
        const key = String(row.session_id || "");
        const current = attendeesBySession.get(key) || [];
        if (!current.includes(row.member_id)) {
          current.push(row.member_id);
        }
        attendeesBySession.set(key, current);
      }

      for (const session of candidateSessions) {
        const startsAt = new Date(session.starts_at);
        const attendees = attendeesBySession.get(session.id) || [];
        const timeLabel = startsAt.toLocaleString("tr-TR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        await Promise.all([
          ...attendees.map((memberId) =>
            MobileNotificationService.queuePush({
              tenantId,
              userId: memberId,
              roleScope: "MEMBER",
              type: "GROUP_CLASS_REMINDER",
              title: `${session.title} yaklasiyor`,
              body: `${session.title} dersi ${hour} saat sonra basliyor. Seansin: ${timeLabel}.`,
              deepLink: "/(member)/bookings",
              meta: {
                session_id: session.id,
                hours_before_start: hour,
                starts_at: startsAt.toISOString(),
                screen: "CALENDAR",
              },
            })
          ),
          ...(session.trainer_id
            ? [
                MobileNotificationService.queuePush({
                  tenantId,
                  userId: session.trainer_id,
                  roleScope: "TRAINER",
                  type: "GROUP_CLASS_REMINDER",
                  title: `${session.title} yaklasiyor`,
                  body: `${session.title} dersi ${hour} saat sonra basliyor. Katilim listesini kontrol et.`,
                  deepLink: "/(trainer)/calendar",
                  meta: {
                    session_id: session.id,
                    hours_before_start: hour,
                    starts_at: startsAt.toISOString(),
                    screen: "CALENDAR",
                  },
                }),
              ]
            : []),
          ...adminIds.map((adminId) =>
            MobileNotificationService.queuePush({
              tenantId,
              userId: adminId,
              roleScope: "ADMIN",
              type: "GROUP_CLASS_REMINDER",
              title: `${session.title} yaklasiyor`,
              body: `${session.title} dersi ${hour} saat sonra basliyor. Operasyon takvimini kontrol et.`,
              deepLink: "/(admin)/calendar",
              meta: {
                session_id: session.id,
                hours_before_start: hour,
                starts_at: startsAt.toISOString(),
                screen: "CALENDAR",
              },
            })
          ),
        ]);

        session.meta = {
          ...(session.meta || {}),
          [alreadySentKey]: new Date().toISOString(),
        };
        await sessionRepo.save(session);
      }
    }
  }
}
