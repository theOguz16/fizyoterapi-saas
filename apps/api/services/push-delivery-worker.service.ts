import { In, LessThanOrEqual } from "typeorm";
import { AppDataSource } from "../data-source";
import { DeviceToken } from "../entities/device-token.entity";
import {
  NotificationDelivery,
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
} from "../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { JobLockService } from "./job-lock.service";

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_SEND_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";
const SEND_BATCH_SIZE = 100;
const RECEIPT_BATCH_SIZE = 1000;
const MAX_RECEIPT_CHECKS = 8;
const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_RECHECK_DELAY_MS = 2 * 60_000;
const PROVIDER_TIMEOUT_MS = 15_000;
const TRANSIENT_EXPO_ERRORS = new Set(["MessageRateExceeded", "ExpoServerError"]);

export function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

export function pushRetryDelayMs(attemptCount: number) {
  const delays = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
  return delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)];
}

export function isPermanentExpoError(errorCode: string) {
  return Boolean(errorCode) && !TRANSIENT_EXPO_ERRORS.has(errorCode);
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function errorMessage(error: unknown, fallback: string) {
  return (error instanceof Error ? error.message : String(error || fallback)).slice(0, 240);
}

export class PushDeliveryWorkerService {
  static async runOnce(now = new Date()) {
    return JobLockService.withAdvisoryLock(AppDataSource, "expo-push-delivery-worker", async () => {
      const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
      const staleSendingAt = new Date(now.getTime() - 5 * 60_000);
      const sendable = await deliveryRepo.find({
        where: [
          {
            channel: NotificationDeliveryChannel.EXPO_PUSH,
            status: In([NotificationDeliveryStatus.QUEUED, NotificationDeliveryStatus.RETRY_SCHEDULED]),
            next_attempt_at: LessThanOrEqual(now),
          },
          {
            channel: NotificationDeliveryChannel.EXPO_PUSH,
            status: NotificationDeliveryStatus.SENDING,
            last_attempt_at: LessThanOrEqual(staleSendingAt),
          },
        ] as any,
        order: { next_attempt_at: "ASC", created_at: "ASC" },
        take: 500,
      });
      const receiptDue = await deliveryRepo.find({
        where: {
          channel: NotificationDeliveryChannel.EXPO_PUSH,
          status: NotificationDeliveryStatus.AWAITING_RECEIPT,
          receipt_check_at: LessThanOrEqual(now),
        } as any,
        order: { receipt_check_at: "ASC" },
        take: 1000,
      });

      await PushDeliveryWorkerService.send(sendable, now);
      await PushDeliveryWorkerService.checkReceipts(receiptDue, now);
      await PushDeliveryWorkerService.refreshEvents(
        Array.from(new Set([...sendable, ...receiptDue].map((delivery) => delivery.event_id)))
      );

      return { sendable: sendable.length, receiptDue: receiptDue.length };
    });
  }

  static async send(deliveries: NotificationDelivery[], now = new Date()) {
    const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);

    for (const batch of chunks(deliveries, SEND_BATCH_SIZE)) {
      const valid: NotificationDelivery[] = [];
      for (const delivery of batch) {
        delivery.attempt_count = Number(delivery.attempt_count || 0) + 1;
        delivery.last_attempt_at = now;
        delivery.error_message = null;
        if (!delivery.token_snapshot || !isExpoPushToken(delivery.token_snapshot)) {
          await PushDeliveryWorkerService.fail(delivery, "UNSUPPORTED_PUSH_TOKEN", true);
        } else {
          delivery.status = NotificationDeliveryStatus.SENDING;
          valid.push(delivery);
        }
      }
      await deliveryRepo.save(batch);
      if (valid.length === 0) continue;

      try {
        const response = await PushDeliveryWorkerService.request(EXPO_SEND_ENDPOINT, valid.map((delivery) => ({
          to: delivery.token_snapshot,
          sound: "default",
          title: delivery.title,
          body: delivery.body,
          data: delivery.data || {},
        })));
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 180);
          for (const delivery of valid) {
            await PushDeliveryWorkerService.retryOrFail(delivery, `EXPO_HTTP_${response.status}:${detail}`, now);
          }
          continue;
        }

        const payload = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = Array.isArray(payload.data) ? payload.data : [];
        for (const [index, delivery] of valid.entries()) {
          const ticket = tickets[index];
          if (ticket?.status === "ok" && ticket.id) {
            delivery.status = NotificationDeliveryStatus.AWAITING_RECEIPT;
            delivery.provider_ticket_id = ticket.id;
            delivery.receipt_attempt_count = 0;
            delivery.receipt_check_at = new Date(now.getTime() + RECEIPT_DELAY_MS);
            delivery.next_attempt_at = null;
            delivery.sent_at = now;
            delivery.error_message = null;
            await deliveryRepo.save(delivery);
            continue;
          }

          const code = ticket?.details?.error || "EXPO_TICKET_FAILED";
          const detail = ticket?.message ? `${code}:${ticket.message}` : code;
          if (isPermanentExpoError(code)) {
            await PushDeliveryWorkerService.fail(delivery, detail, code === "DeviceNotRegistered");
          } else {
            await PushDeliveryWorkerService.retryOrFail(delivery, detail, now);
          }
        }
      } catch (error) {
        for (const delivery of valid) {
          await PushDeliveryWorkerService.retryOrFail(delivery, errorMessage(error, "EXPO_PUSH_REQUEST_FAILED"), now);
        }
      }
    }
  }

  static async checkReceipts(deliveries: NotificationDelivery[], now = new Date()) {
    const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
    const withTickets = deliveries.filter((delivery) => Boolean(delivery.provider_ticket_id));
    for (const delivery of deliveries.filter((row) => !row.provider_ticket_id)) {
      await PushDeliveryWorkerService.retryOrFail(delivery, "EXPO_TICKET_ID_MISSING", now);
    }

    for (const batch of chunks(withTickets, RECEIPT_BATCH_SIZE)) {
      try {
        const response = await PushDeliveryWorkerService.request(
          EXPO_RECEIPTS_ENDPOINT,
          { ids: batch.map((delivery) => delivery.provider_ticket_id) }
        );
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 180);
          await PushDeliveryWorkerService.deferReceiptChecks(batch, `EXPO_RECEIPT_HTTP_${response.status}:${detail}`, now);
          continue;
        }

        const payload = (await response.json()) as { data?: Record<string, ExpoReceipt> };
        for (const delivery of batch) {
          const receipt = payload.data?.[String(delivery.provider_ticket_id)];
          if (!receipt) {
            await PushDeliveryWorkerService.deferReceiptChecks([delivery], "EXPO_RECEIPT_PENDING", now);
          } else if (receipt.status === "ok") {
            delivery.status = NotificationDeliveryStatus.DELIVERED;
            delivery.delivered_at = now;
            delivery.receipt_check_at = null;
            delivery.error_message = null;
            await deliveryRepo.save(delivery);
          } else {
            const code = receipt.details?.error || "EXPO_RECEIPT_FAILED";
            const detail = receipt.message ? `${code}:${receipt.message}` : code;
            if (TRANSIENT_EXPO_ERRORS.has(code)) {
              delivery.provider_ticket_id = null;
              delivery.receipt_check_at = null;
              await PushDeliveryWorkerService.retryOrFail(delivery, detail, now);
            } else {
              await PushDeliveryWorkerService.fail(delivery, detail, code === "DeviceNotRegistered");
            }
          }
        }
      } catch (error) {
        await PushDeliveryWorkerService.deferReceiptChecks(
          batch,
          errorMessage(error, "EXPO_RECEIPT_REQUEST_FAILED"),
          now
        );
      }
    }
  }

  private static async request(url: string, body: unknown) {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      return await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async retryOrFail(delivery: NotificationDelivery, reason: string, now: Date) {
    if (Number(delivery.attempt_count || 0) >= Number(delivery.max_attempts || 4)) {
      return PushDeliveryWorkerService.fail(delivery, reason);
    }
    delivery.status = NotificationDeliveryStatus.RETRY_SCHEDULED;
    delivery.next_attempt_at = new Date(now.getTime() + pushRetryDelayMs(delivery.attempt_count));
    delivery.receipt_check_at = null;
    delivery.error_message = reason.slice(0, 240);
    await AppDataSource.getRepository(NotificationDelivery).save(delivery);
  }

  private static async deferReceiptChecks(deliveries: NotificationDelivery[], reason: string, now: Date) {
    const repo = AppDataSource.getRepository(NotificationDelivery);
    for (const delivery of deliveries) {
      delivery.receipt_attempt_count = Number(delivery.receipt_attempt_count || 0) + 1;
      delivery.error_message = reason.slice(0, 240);
      if (delivery.receipt_attempt_count >= MAX_RECEIPT_CHECKS) {
        delivery.status = NotificationDeliveryStatus.FAILED;
        delivery.receipt_check_at = null;
      } else {
        delivery.receipt_check_at = new Date(now.getTime() + RECEIPT_RECHECK_DELAY_MS);
      }
      await repo.save(delivery);
    }
  }

  private static async fail(delivery: NotificationDelivery, reason: string, deactivateToken = false) {
    delivery.status = NotificationDeliveryStatus.FAILED;
    delivery.next_attempt_at = null;
    delivery.receipt_check_at = null;
    delivery.error_message = reason.slice(0, 240);
    await AppDataSource.getRepository(NotificationDelivery).save(delivery);
    if (deactivateToken && delivery.device_token_id) {
      await AppDataSource.getRepository(DeviceToken).update(
        { id: delivery.device_token_id },
        { is_active: false }
      );
    }
  }

  private static async refreshEvents(eventIds: string[]) {
    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
    for (const eventId of eventIds) {
      const deliveries = await deliveryRepo.find({ where: { event_id: eventId } });
      if (deliveries.length === 0) continue;
      const counts = {
        queued: deliveries.filter((row) => [
          NotificationDeliveryStatus.QUEUED,
          NotificationDeliveryStatus.SENDING,
          NotificationDeliveryStatus.RETRY_SCHEDULED,
        ].includes(row.status)).length,
        awaiting_receipt: deliveries.filter((row) => row.status === NotificationDeliveryStatus.AWAITING_RECEIPT).length,
        delivered: deliveries.filter((row) => [NotificationDeliveryStatus.DELIVERED, NotificationDeliveryStatus.SENT].includes(row.status)).length,
        failed: deliveries.filter((row) => row.status === NotificationDeliveryStatus.FAILED).length,
      };
      const event = await eventRepo.findOne({ where: { id: eventId } });
      if (!event) continue;
      event.payload = { ...event.payload, delivery_summary: counts };
      const terminal = counts.queued === 0 && counts.awaiting_receipt === 0;
      if (terminal) {
        event.status = counts.delivered > 0 ? NotificationEventStatus.PROCESSED : NotificationEventStatus.FAILED;
        event.processed_at = new Date();
        event.error_message = counts.failed > 0 ? `${counts.failed} push teslimatı başarısız oldu` : null;
      }
      await eventRepo.save(event);
    }
  }
}
