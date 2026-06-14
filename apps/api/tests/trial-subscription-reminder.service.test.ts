import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { Tenant } from "../entities/tenant.entity";
import { JobLockService } from "../services/job-lock.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { TrialSubscriptionReminderService } from "../services/trial-subscription-reminder.service";

describe("trial subscription reminder service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs every published trial or active tenant inside the batch lock", async () => {
    const tenants = [
      { id: "tenant-1", review_status: "PUBLISHED", subscription_status: "TRIAL" },
      { id: "tenant-2", review_status: "PUBLISHED", subscription_status: "ACTIVE" },
    ];
    const tenantRepo = {
      find: vi.fn().mockResolvedValue(tenants),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    vi.spyOn(JobLockService, "withAdvisoryLock").mockImplementation(async (_dataSource, _key, callback) => ({
      executed: true,
      result: await callback(),
    }));
    const syncTenantState = vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (tenant) => tenant as any);

    const result = await TrialSubscriptionReminderService.triggerAllTenants();

    expect(result).toEqual({ executed: true, result: { tenantCount: 2, processed: 2 } });
    expect(tenantRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        is_active: true,
        review_status: "PUBLISHED",
        subscription_status: expect.anything(),
      }),
    });
    expect(syncTenantState).toHaveBeenCalledTimes(2);
  });
});
