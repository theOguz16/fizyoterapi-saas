// Bu servis modulu backend tarafinda tenant lifecycle.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { UserRole } from "../entities/user.entity";
import { MobileNotificationService } from "./mobile-notification.service";

const HOUR_MS = 60 * 60 * 1000;
const TRIAL_EXPIRY_WARNING_HOURS = [48, 24, 12, 4] as const;
const TRIAL_EXPIRY_WARNING_EVENT = "ADMIN_TRIAL_EXPIRING";
const SUBSCRIPTION_EXPIRY_WARNING_EVENT = "ADMIN_SUBSCRIPTION_EXPIRING";

export class TenantLifecycleService {
  static isBoosted(tenant: Tenant | null | undefined) {
    return Boolean(tenant?.boost_until && new Date(tenant.boost_until).getTime() > Date.now());
  }

  static async syncTenantState(tenant: Tenant | null | undefined) {
    if (!tenant) return null;

    const trialEndsAt = tenant.trial_ends_at
      ? new Date(tenant.trial_ends_at)
      : tenant.subscription_status === TenantSubscriptionStatus.TRIAL && tenant.subscription_current_period_ends_at
      ? new Date(tenant.subscription_current_period_ends_at)
      : null;
    const currentPeriodEndsAt = tenant.subscription_current_period_ends_at ? new Date(tenant.subscription_current_period_ends_at) : null;
    const now = Date.now();

    if (
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      tenant.subscription_status === TenantSubscriptionStatus.TRIAL &&
      trialEndsAt &&
      trialEndsAt.getTime() <= now
    ) {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      await AppDataSource.getRepository(Tenant).save(tenant);
      return tenant;
    }

    if (
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      tenant.subscription_status === TenantSubscriptionStatus.ACTIVE &&
      currentPeriodEndsAt &&
      currentPeriodEndsAt.getTime() <= now
    ) {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      await AppDataSource.getRepository(Tenant).save(tenant);
      return tenant;
    }

    if (
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      tenant.subscription_status === TenantSubscriptionStatus.TRIAL &&
      trialEndsAt &&
      trialEndsAt.getTime() - now <= TRIAL_EXPIRY_WARNING_HOURS[0] * HOUR_MS
    ) {
      await TenantLifecycleService.queueTrialExpiryWarning(tenant, trialEndsAt, trialEndsAt.getTime() - now);
    }

    if (
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      tenant.subscription_status === TenantSubscriptionStatus.ACTIVE &&
      currentPeriodEndsAt &&
      currentPeriodEndsAt.getTime() - now <= TRIAL_EXPIRY_WARNING_HOURS[0] * HOUR_MS
    ) {
      await TenantLifecycleService.queueExpiryWarning({
        tenant,
        endsAt: currentPeriodEndsAt,
        remainingMs: currentPeriodEndsAt.getTime() - now,
        eventPrefix: SUBSCRIPTION_EXPIRY_WARNING_EVENT,
        title: "Abonelik dönemin yenilenmek üzere",
        body: (hours) => `${tenant.name} için mevcut abonelik dönemin ${hours} saat içinde sona eriyor. Yenileme durumunu plan ekranından kontrol edebilirsin.`,
        payloadKey: "subscription_period_ends_at",
      });
    }

    return tenant;
  }

  private static async queueTrialExpiryWarning(tenant: Tenant, trialEndsAt: Date, remainingMs: number) {
    return TenantLifecycleService.queueExpiryWarning({
      tenant,
      endsAt: trialEndsAt,
      remainingMs,
      eventPrefix: TRIAL_EXPIRY_WARNING_EVENT,
      title: "Deneme süren bitmek üzere",
      body: (hours) => `${tenant.name} için FizyoFlow denemen ${hours} saat içinde bitecek. Erişimin kesilmemesi için planını etkinleştir.`,
      payloadKey: "trial_ends_at",
    });
  }

  private static async queueExpiryWarning(input: {
    tenant: Tenant;
    endsAt: Date;
    remainingMs: number;
    eventPrefix: string;
    title: string;
    body: (hours: number) => string;
    payloadKey: "trial_ends_at" | "subscription_period_ends_at";
  }) {
    const { tenant, endsAt, remainingMs, eventPrefix, title, body, payloadKey } = input;
    let thresholdHours: (typeof TRIAL_EXPIRY_WARNING_HOURS)[number] | null = null;
    for (const hours of TRIAL_EXPIRY_WARNING_HOURS) {
      if (remainingMs <= hours * HOUR_MS) {
        thresholdHours = hours;
      }
    }
    if (!thresholdHours) return;

    const membership = await AppDataSource.getRepository(SalonMembership).findOne({
      where: {
        tenant_id: tenant.id,
        role: UserRole.ADMIN,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      } as any,
      order: { updated_at: "DESC" },
    });
    if (!membership?.user_id) return;

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const eventType = `${eventPrefix}_${thresholdHours}H`;
    const existing = await eventRepo.findOne({
      where: {
        tenant_id: tenant.id,
        member_id: membership.user_id,
        type: eventType,
      } as any,
    });
    if (existing) return;

    const pushResult = await MobileNotificationService.queuePush({
      tenantId: tenant.id,
      userId: membership.user_id,
      roleScope: "ADMIN",
      type: eventType,
      title,
      body: body(thresholdHours),
      deepLink: "/(admin)/subscription",
      meta: {
        [payloadKey]: endsAt.toISOString(),
        threshold_hours: thresholdHours,
      },
    });

    if ("reason" in pushResult && pushResult.reason === "QUIET_HOURS") return;

    await eventRepo.save(
      eventRepo.create({
        tenant_id: tenant.id,
        member_id: membership.user_id,
        type: eventType,
        payload: {
          [payloadKey]: endsAt.toISOString(),
          tenant_name: tenant.name,
          threshold_hours: thresholdHours,
          delivery_result: pushResult,
        },
        status: NotificationEventStatus.PROCESSED,
        processed_at: new Date(),
      })
    );
  }
}
