// Bu servis modulu backend tarafinda risk notification.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { NotificationDelivery, NotificationDeliveryChannel, NotificationDeliveryStatus } from "../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { RiskService } from "./risk.service";

export class RiskNotificationService {
  static async trigger(params: {
    tenantId: string;
    triggeredByAdminId?: string;
    memberIds?: string[];
    riskSegment?: "AT_RISK" | "HEALTHY" | "ALL";
  }) {
    const { tenantId, triggeredByAdminId, memberIds, riskSegment = "AT_RISK" } = params;

    const riskResult = await RiskService.listRiskMembers({
      tenantId,
      memberIds,
      riskSegment,
      memberActivity: "ACTIVE",
      limit: 500,
    });

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
    const now = new Date();

    const events: NotificationEvent[] = [];
    for (const row of riskResult.data) {
      const event = eventRepo.create({
        tenant_id: tenantId,
        type: "RISK_ALERT",
        member_id: row.member_id,
        payload: {
          member_full_name: row.full_name,
          risk_level: row.level,
          score: row.score,
          reasons: row.reasons,
          sent_via: "MOCK_PUSH",
        },
        status: NotificationEventStatus.PROCESSED,
        triggered_by_admin_id: triggeredByAdminId,
        processed_at: now,
      });
      events.push(event);
    }

    if (events.length > 0) {
      await eventRepo.save(events);
    }

    const deliveries = events.map((event) =>
      deliveryRepo.create({
        tenant_id: tenantId,
        event_id: event.id,
        member_id: event.member_id,
        channel: NotificationDeliveryChannel.MOCK_PUSH,
        status: NotificationDeliveryStatus.SENT,
        sent_at: now,
      })
    );

    if (deliveries.length > 0) {
      await deliveryRepo.save(deliveries);
    }

    return {
      totalTargeted: riskResult.data.length,
      eventsCreated: events.length,
      deliveriesCreated: deliveries.length,
      preview: riskResult.data.slice(0, 10),
    };
  }

  static async logs(tenantId: string, limit = 100) {
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 500) : 100;

    const events = await AppDataSource.getRepository(NotificationEvent).find({
      where: { tenant_id: tenantId, type: "RISK_ALERT" },
      order: { created_at: "DESC" },
      take: normalizedLimit,
    });

    const eventIds = events.map((event) => event.id);
    const deliveries = eventIds.length
      ? await AppDataSource.getRepository(NotificationDelivery)
          .createQueryBuilder("d")
          .where("d.tenant_id = :tenantId", { tenantId })
          .andWhere("d.event_id IN (:...eventIds)", { eventIds })
          .orderBy("d.created_at", "DESC")
          .getMany()
      : [];

    const deliveriesByEvent = new Map<string, NotificationDelivery[]>();
    for (const delivery of deliveries) {
      const list = deliveriesByEvent.get(delivery.event_id) ?? [];
      list.push(delivery);
      deliveriesByEvent.set(delivery.event_id, list);
    }

    return {
      data: events.map((event) => ({
        ...event,
        deliveries: deliveriesByEvent.get(event.id) ?? [],
      })),
      limit: normalizedLimit,
    };
  }
}
