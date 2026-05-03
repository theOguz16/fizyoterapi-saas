// Bu servis modulu backend tarafinda mobile notification.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { DeviceToken } from "../entities/device-token.entity";
import { NotificationDelivery, NotificationDeliveryChannel, NotificationDeliveryStatus } from "../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
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

export class MobileNotificationService {
  private static async resolveTenantSlug(tenantId: string) {
    const tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: ["id", "slug"],
    });
    return tenant?.slug || "";
  }

  static async queuePush(input: QueuePushInput) {
    const { tenantId, userId, roleScope, type, title, body, deepLink, meta } = input;
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
