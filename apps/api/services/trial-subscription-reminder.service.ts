// Bu servis deneme aboneligi bitis bildirimlerini process icindeki periyodik batch'e baglar.
// Eşik ve duplicate kontrolu TenantLifecycleService tarafinda tutulur.
import { AppDataSource } from "../data-source";
import { In } from "typeorm";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { JobLockService } from "./job-lock.service";
import { TenantLifecycleService } from "./tenant-lifecycle.service";

export class TrialSubscriptionReminderService {
  static async triggerAllTenants() {
    return JobLockService.withAdvisoryLock(AppDataSource, "trial-subscription-reminder-batch", async () => {
      const tenants = await AppDataSource.getRepository(Tenant).find({
        where: {
          is_active: true,
          review_status: TenantReviewStatus.PUBLISHED,
          subscription_status: In([TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE]),
        },
      });

      let processed = 0;
      for (const tenant of tenants) {
        await TenantLifecycleService.syncTenantState(tenant);
        processed += 1;
      }

      return { tenantCount: tenants.length, processed };
    });
  }
}
