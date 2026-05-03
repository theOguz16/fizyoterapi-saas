// Bu servis modulu backend tarafinda tenant lifecycle.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";

export class TenantLifecycleService {
  static isBoosted(tenant: Tenant | null | undefined) {
    return Boolean(tenant?.boost_until && new Date(tenant.boost_until).getTime() > Date.now());
  }

  static async syncTenantState(tenant: Tenant | null | undefined) {
    if (!tenant) return null;

    if (
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      tenant.subscription_status === TenantSubscriptionStatus.TRIAL &&
      tenant.trial_ends_at &&
      new Date(tenant.trial_ends_at).getTime() <= Date.now()
    ) {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      await AppDataSource.getRepository(Tenant).save(tenant);
    }

    return tenant;
  }
}
