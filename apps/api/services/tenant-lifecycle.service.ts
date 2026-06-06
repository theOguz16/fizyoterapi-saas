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

export class TenantLifecycleService {
  static isBoosted(tenant: Tenant | null | undefined) {
    return Boolean(tenant?.boost_until && new Date(tenant.boost_until).getTime() > Date.now());
  }

  static async syncTenantState(tenant: Tenant | null | undefined) {
    if (!tenant) return null;

    const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
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
      tenant.subscription_status === TenantSubscriptionStatus.TRIAL &&
      trialEndsAt &&
      trialEndsAt.getTime() - now <= TRIAL_EXPIRY_WARNING_HOURS[0] * HOUR_MS
    ) {
      await TenantLifecycleService.queueTrialExpiryWarning(tenant, trialEndsAt, trialEndsAt.getTime() - now);
    }

    return tenant;
  }

  private static async queueTrialExpiryWarning(tenant: Tenant, trialEndsAt: Date, remainingMs: number) {
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
    const eventType = `${TRIAL_EXPIRY_WARNING_EVENT}_${thresholdHours}H`;
    const existing = await eventRepo.findOne({
      where: {
        tenant_id: tenant.id,
        member_id: membership.user_id,
        type: eventType,
      } as any,
    });
    if (existing) return;

    const warningEvent = await eventRepo.save(
      eventRepo.create({
        tenant_id: tenant.id,
        member_id: membership.user_id,
        type: eventType,
        payload: {
          trial_ends_at: trialEndsAt.toISOString(),
          tenant_name: tenant.name,
          threshold_hours: thresholdHours,
        },
        status: NotificationEventStatus.PROCESSED,
        processed_at: new Date(),
      })
    );

    await MobileNotificationService.queuePush({
      tenantId: tenant.id,
      userId: membership.user_id,
      roleScope: "ADMIN",
      type: eventType,
      title: "Deneme süren bitmek üzere",
      body: `${tenant.name} için FizyoFlow denemen ${thresholdHours} saat içinde bitecek. Erişimin kesilmemesi için planını etkinleştir.`,
      deepLink: "/(admin)/subscription",
      meta: {
        event_id: warningEvent.id,
        trial_ends_at: trialEndsAt.toISOString(),
        threshold_hours: thresholdHours,
      },
    });
  }
}
