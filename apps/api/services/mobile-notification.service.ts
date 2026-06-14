// Bu servis modulu backend tarafinda mobile notification.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { DeviceToken } from "../entities/device-token.entity";
import { NotificationDelivery, NotificationDeliveryChannel, NotificationDeliveryStatus } from "../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { SalonMembership } from "../entities/salon-membership.entity";
import { Tenant } from "../entities/tenant.entity";

type RoleScope = "MEMBER" | "TRAINER" | "ADMIN";

type QueuePushInput = {
  tenantId: string;
  userId: string;
  roleScope: RoleScope;
  type: string;
  title: string;
  body: string;
  deepLink?: string;
  meta?: Record<string, unknown>;
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type DeliveryResult = {
  token: string;
  platform: string;
  status: NotificationDeliveryStatus;
  error?: string;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
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
    const { tenantId, userId, roleScope, type, title, body, deepLink, meta } = input;
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

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
    const tenantSlug = await MobileNotificationService.resolveTenantSlug(tenantId);
    const notificationData: Record<string, unknown> = {
      ...(meta || {}),
      href: deepLink || null,
      role: roleScope,
      tenant_slug: tenantSlug,
      type,
    };

    const event = await eventRepo.save(
      eventRepo.create({
        tenant_id: tenantId,
        member_id: userId,
        type: "MOBILE_PUSH",
        payload: {
          type,
          title,
          body,
          deep_link: deepLink || null,
          tenant_slug: tenantSlug,
          role_scope: roleScope,
          meta: meta || {},
          devices: activeTokens.map((row) => ({
            token: row.token,
            platform: row.platform,
          })),
        },
        status: NotificationEventStatus.QUEUED,
      })
    );

    const results = await MobileNotificationService.dispatchExpoPush({
      title,
      body,
      data: notificationData,
      devices: activeTokens.map((row) => ({ token: row.token, platform: row.platform })),
    });

    const deliveries = results.map((result) =>
      deliveryRepo.create({
        tenant_id: tenantId,
        event_id: event.id,
        member_id: userId,
        channel: NotificationDeliveryChannel.MOCK_PUSH,
        status: result.status,
        sent_at: result.status === NotificationDeliveryStatus.SENT ? new Date() : undefined,
        error_message: result.error,
      })
    );
    await deliveryRepo.save(deliveries);

    const failedCount = results.filter((result) => result.status === NotificationDeliveryStatus.FAILED).length;
    event.status = failedCount === results.length ? NotificationEventStatus.FAILED : NotificationEventStatus.PROCESSED;
    event.processed_at = new Date();
    event.error_message = failedCount > 0 ? `${failedCount} push teslimati basarisiz oldu` : undefined;
    event.payload = {
      ...event.payload,
      delivery_results: results,
      provider: "EXPO_PUSH",
    };
    await eventRepo.save(event);

    return {
      queued: failedCount < results.length,
      count: results.length - failedCount,
      failedCount,
      eventId: event.id,
    };
  }

  private static async dispatchExpoPush(input: {
    title: string;
    body: string;
    data: Record<string, unknown>;
    devices: Array<{ token: string; platform: string }>;
  }) {
    const invalidResults = input.devices
      .filter((device) => !isExpoPushToken(device.token))
      .map<DeliveryResult>((device) => ({
        token: device.token,
        platform: device.platform,
        status: NotificationDeliveryStatus.FAILED,
        error: "UNSUPPORTED_PUSH_TOKEN",
      }));

    const expoDevices = input.devices.filter((device) => isExpoPushToken(device.token));
    if (expoDevices.length === 0) {
      return invalidResults;
    }

    const results: DeliveryResult[] = [];
    for (let index = 0; index < expoDevices.length; index += EXPO_PUSH_BATCH_SIZE) {
      const batch = expoDevices.slice(index, index + EXPO_PUSH_BATCH_SIZE);
      const messages: ExpoPushMessage[] = batch.map((device) => ({
        to: device.token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: input.data,
      }));

      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          const body = await response.text();
          results.push(
            ...batch.map((device) => ({
              token: device.token,
              platform: device.platform,
              status: NotificationDeliveryStatus.FAILED,
              error: `EXPO_HTTP_${response.status}:${body.slice(0, 180)}`,
            }))
          );
          continue;
        }

        const payload = (await response.json()) as { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> };
        const tickets = Array.isArray(payload?.data) ? payload.data : [];
        results.push(
          ...batch.map((device, ticketIndex) => {
            const ticket = tickets[ticketIndex];
            const failed = ticket?.status !== "ok";
            return {
              token: device.token,
              platform: device.platform,
              status: failed ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.SENT,
              error: failed ? ticket?.details?.error || ticket?.message || "EXPO_TICKET_FAILED" : undefined,
            };
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "EXPO_PUSH_REQUEST_FAILED";
        results.push(
          ...batch.map((device) => ({
            token: device.token,
            platform: device.platform,
            status: NotificationDeliveryStatus.FAILED,
            error: message,
          }))
        );
      }
    }

    return [...results, ...invalidResults];
  }
}
