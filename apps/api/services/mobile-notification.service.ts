// Bu servis modulu backend tarafinda mobile notification.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { DeviceToken } from "../entities/device-token.entity";
import { NotificationDelivery, NotificationDeliveryChannel, NotificationDeliveryStatus } from "../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { SalonMembership } from "../entities/salon-membership.entity";
import { Tenant } from "../entities/tenant.entity";
import type { PushDeepLinkHref, PushNotificationData, SessionRole } from "@fitnes-saas/contracts";

type RoleScope = SessionRole;

type QueuePushInput = {
  tenantId: string;
  userId: string;
  roleScope: RoleScope;
  type: string;
  title: string;
  body: string;
  deepLink: PushDeepLinkHref;
  meta?: Record<string, unknown>;
};

const CANONICAL_PUSH_PATHS: Record<RoleScope, ReadonlySet<string>> = {
  ADMIN: new Set(["/(admin)/approvals", "/(admin)/calendar", "/(admin)/subscription"]),
  TRAINER: new Set(["/(trainer)/bookings", "/(trainer)/calendar", "/(trainer)/checkin", "/(trainer)/group-classes"]),
  MEMBER: new Set([
    "/(member)/attendance",
    "/(member)/bookings",
    "/(member)/calendar",
    "/(member)/campaigns",
    "/(member)/group-classes",
    "/(member)/home",
    "/(member)/package",
    "/(member)/referrals",
  ]),
};

export function resolveCanonicalPushHref(roleScope: RoleScope, input: string): PushDeepLinkHref {
  const href = String(input || "").trim();
  if (
    !/^\/\((admin|trainer|member|auth)\)\/[a-z0-9][a-z0-9/_%-]*(?:\?[^#\s]*)?$/i.test(href) ||
    href.includes("#") ||
    href.includes("\\") ||
    href.includes("..") ||
    href.includes("://")
  ) {
    throw new Error("INVALID_PUSH_DEEP_LINK");
  }

  const parsed = new URL(href, "https://push.fizyoflow.local");
  const isRoleRoute = CANONICAL_PUSH_PATHS[roleScope].has(parsed.pathname);
  const isMemberInviteRoute = roleScope === "MEMBER" && parsed.pathname === "/(auth)/invite-accept";
  if (parsed.origin !== "https://push.fizyoflow.local" || (!isRoleRoute && !isMemberInviteRoute)) {
    throw new Error("PUSH_DEEP_LINK_ROLE_MISMATCH");
  }

  return href as PushDeepLinkHref;
}

function parseClock(value: unknown) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isWithinQuietHours(
  quietHours: unknown,
  now = new Date(),
  timeZone = "Europe/Istanbul"
) {
  if (!quietHours || typeof quietHours !== "object" || Array.isArray(quietHours)) return false;
  const input = quietHours as { enabled?: unknown; start?: unknown; end?: unknown };
  if (input.enabled !== true) return false;

  const start = parseClock(input.start);
  const end = parseClock(input.end);
  if (start === null || end === null || start === end) return false;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;

  return start < end ? current >= start && current < end : current >= start || current < end;
}

export class MobileNotificationService {
  private static async shouldSendToUser(input: { tenantId: string; userId: string; type: string }) {
    const membershipRepo = AppDataSource.getRepository(SalonMembership);
    if (typeof (membershipRepo as any).findOne !== "function") return { allowed: true as const };
    const membership = await membershipRepo.findOne({
      where: { tenant_id: input.tenantId, user_id: input.userId } as any,
      order: { updated_at: "DESC" },
    });
    if (!membership?.account_id) return { allowed: true as const };

    const accountRepo = AppDataSource.getRepository(Account);
    if (typeof (accountRepo as any).findOne !== "function") return { allowed: true as const };
    const account = await accountRepo.findOne({
      where: { id: membership.account_id },
      select: ["id", "notification_preferences"],
    });
    const preferences = account?.notification_preferences || {};
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return { allowed: true as const };

    const tenantRepo = AppDataSource.getRepository(Tenant);
    const tenant = typeof (tenantRepo as any).findOne === "function"
      ? await tenantRepo.findOne({ where: { id: input.tenantId }, select: ["id", "timezone"] })
      : null;
    if (isWithinQuietHours((preferences as any).quiet_hours, new Date(), tenant?.timezone || "Europe/Istanbul")) {
      return { allowed: false as const, reason: "QUIET_HOURS" as const };
    }

    const type = input.type.toUpperCase();
    if (type.startsWith("ADMIN_TRIAL_EXPIRING") || type.startsWith("ADMIN_SUBSCRIPTION_EXPIRING")) {
      const trialPrefs = (preferences as any).subscription_trial_reminders || {};
      if (type.includes("_48H")) return { allowed: trialPrefs.forty_eight_hours !== false, reason: "USER_PREFERENCES_DISABLED" as const };
      if (type.includes("_24H")) return { allowed: trialPrefs.twenty_four_hours !== false, reason: "USER_PREFERENCES_DISABLED" as const };
      if (type.includes("_12H")) return { allowed: trialPrefs.twelve_hours !== false, reason: "USER_PREFERENCES_DISABLED" as const };
      if (type.includes("_4H")) return { allowed: trialPrefs.four_hours !== false, reason: "USER_PREFERENCES_DISABLED" as const };
      return { allowed: true as const };
    }
    if (type.includes("CAMPAIGN")) return { allowed: (preferences as any).campaign_alerts !== false, reason: "USER_PREFERENCES_DISABLED" as const };
    if (type.includes("PACKAGE")) return { allowed: (preferences as any).package_expiry_reminders !== false, reason: "USER_PREFERENCES_DISABLED" as const };
    if (type.includes("MEASUREMENT")) return { allowed: (preferences as any).measurement_reminders !== false, reason: "USER_PREFERENCES_DISABLED" as const };
    if (type.includes("WEEKLY")) return { allowed: (preferences as any).weekly_summary !== false, reason: "USER_PREFERENCES_DISABLED" as const };
    if (type.includes("CLASS") || type.includes("BOOKING") || type.includes("SESSION")) {
      const classPrefs = (preferences as any).class_reminders || {};
      const allowed = type.includes("_3H")
        ? classPrefs.three_hours !== false
        : type.includes("_1H")
          ? classPrefs.one_hour !== false
          : classPrefs.three_hours !== false || classPrefs.one_hour !== false;
      return { allowed, reason: "USER_PREFERENCES_DISABLED" as const };
    }
    return { allowed: true as const };
  }

  private static async resolveTenantSlug(tenantId: string) {
    const tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: ["id", "slug"],
    });
    return tenant?.slug || "";
  }

  static async queuePush(input: QueuePushInput) {
    const { tenantId, userId, roleScope, type, title, body, meta } = input;
    const deepLink = resolveCanonicalPushHref(roleScope, input.deepLink);
    const preferenceDecision = await MobileNotificationService.shouldSendToUser({ tenantId, userId, type });
    if (!preferenceDecision.allowed) {
      return { queued: false, reason: preferenceDecision.reason };
    }

    const tokenRepo = AppDataSource.getRepository(DeviceToken);
    const activeTokens = await tokenRepo.find({
      where: {
        tenant_id: tenantId,
        member_id: userId,
        is_active: true,
      },
      select: ["id", "token", "platform"],
      order: { updated_at: "DESC" },
    });

    if (activeTokens.length === 0) {
      return { queued: false, reason: "NO_ACTIVE_DEVICE" as const };
    }

    const tenantSlug = await MobileNotificationService.resolveTenantSlug(tenantId);
    const notificationData: PushNotificationData = {
      ...(meta || {}),
      href: deepLink,
      role: roleScope,
      tenant_slug: tenantSlug,
      type,
    };

    return AppDataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(NotificationEvent);
      const deliveryRepo = manager.getRepository(NotificationDelivery);
      const event = await eventRepo.save(
        eventRepo.create({
          tenant_id: tenantId,
          member_id: userId,
          type: "MOBILE_PUSH",
          payload: {
            type,
            title,
            body,
            deep_link: deepLink,
            tenant_slug: tenantSlug,
            role_scope: roleScope,
            meta: meta || {},
            devices: activeTokens.map((row) => ({ token: row.token, platform: row.platform })),
          },
          status: NotificationEventStatus.QUEUED,
        })
      );

      const now = new Date();
      const deliveries = activeTokens.map((device) =>
        deliveryRepo.create({
          tenant_id: tenantId,
          event_id: event.id,
          member_id: userId,
          channel: NotificationDeliveryChannel.EXPO_PUSH,
          status: NotificationDeliveryStatus.QUEUED,
          device_token_id: device.id,
          token_snapshot: device.token,
          platform: device.platform,
          title,
          body,
          data: notificationData,
          attempt_count: 0,
          max_attempts: 4,
          receipt_attempt_count: 0,
          next_attempt_at: now,
        })
      );
      await deliveryRepo.save(deliveries);
      event.payload = {
        ...event.payload,
        provider: "EXPO_PUSH",
        delivery_summary: { queued: deliveries.length, awaiting_receipt: 0, delivered: 0, failed: 0 },
      };
      await eventRepo.save(event);

      return { queued: true as const, count: deliveries.length, failedCount: 0, eventId: event.id };
    });
  }
}
