import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { NotificationEvent } from "../entities/notification-event.entity";
import { SalonMembership } from "../entities/salon-membership.entity";
import { Tenant } from "../entities/tenant.entity";
import { MobileNotificationService } from "../services/mobile-notification.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";

describe("tenant lifecycle service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves expired trials to read-only and hides the public salon", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Salon",
      review_status: "PUBLISHED",
      subscription_status: "TRIAL",
      is_public: true,
      trial_ends_at: new Date(Date.now() - 60_000),
    };
    const tenantRepo = {
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    await TenantLifecycleService.syncTenantState(tenant as any);

    expect(tenant.subscription_status).toBe("READ_ONLY");
    expect(tenant.is_public).toBe(false);
    expect(tenantRepo.save).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "READ_ONLY", is_public: false }));
  });

  it("moves expired active subscription periods to read-only", async () => {
    const tenant = {
      id: "tenant-active-1",
      name: "Salon",
      review_status: "PUBLISHED",
      subscription_status: "ACTIVE",
      is_public: true,
      subscription_current_period_ends_at: new Date(Date.now() - 60_000),
    };
    const tenantRepo = {
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    await TenantLifecycleService.syncTenantState(tenant as any);

    expect(tenant.subscription_status).toBe("READ_ONLY");
    expect(tenant.is_public).toBe(false);
    expect(tenantRepo.save).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "READ_ONLY", is_public: false }));
  });

  it("queues one push warning for the next crossed trial expiry threshold", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Owner Fizyo",
      review_status: "PUBLISHED",
      subscription_status: "TRIAL",
      is_public: true,
      trial_ends_at: new Date(Date.now() + 60 * 60 * 1000),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue({ user_id: "admin-user-1" }),
    };
    const notificationRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "warning-event-1", ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const queuePush = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: true, count: 1, failedCount: 0, eventId: "push-event-1" } as any);

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === NotificationEvent) return notificationRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    await TenantLifecycleService.syncTenantState(tenant as any);

    expect(notificationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        member_id: "admin-user-1",
        type: "ADMIN_TRIAL_EXPIRING_4H",
        status: "PROCESSED",
      })
    );
    expect(queuePush).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "admin-user-1",
        roleScope: "ADMIN",
        type: "ADMIN_TRIAL_EXPIRING_4H",
        deepLink: "/(admin)/subscription",
        meta: expect.objectContaining({ threshold_hours: 4 }),
      })
    );
  });

  it("uses separate events for 48, 24, 12 and 4 hour trial warnings", async () => {
    const notificationRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: `warning-${input.type}`, ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const queuePush = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: true, count: 1, failedCount: 0 } as any);

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonMembership) return { findOne: vi.fn().mockResolvedValue({ user_id: "admin-user-1" }) } as any;
      if (entity === NotificationEvent) return notificationRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    for (const hours of [47, 23, 11, 3]) {
      await TenantLifecycleService.syncTenantState({
        id: `tenant-${hours}`,
        name: "Owner Fizyo",
        review_status: "PUBLISHED",
        subscription_status: "TRIAL",
        is_public: true,
        trial_ends_at: new Date(Date.now() + hours * 60 * 60 * 1000),
      } as any);
    }

    expect(queuePush).toHaveBeenCalledWith(expect.objectContaining({ type: "ADMIN_TRIAL_EXPIRING_48H" }));
    expect(queuePush).toHaveBeenCalledWith(expect.objectContaining({ type: "ADMIN_TRIAL_EXPIRING_24H" }));
    expect(queuePush).toHaveBeenCalledWith(expect.objectContaining({ type: "ADMIN_TRIAL_EXPIRING_12H" }));
    expect(queuePush).toHaveBeenCalledWith(expect.objectContaining({ type: "ADMIN_TRIAL_EXPIRING_4H" }));
  });

  it("does not queue duplicate trial expiry warnings", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Owner Fizyo",
      review_status: "PUBLISHED",
      subscription_status: "TRIAL",
      is_public: true,
      trial_ends_at: new Date(Date.now() + 60 * 60 * 1000),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue({ user_id: "admin-user-1" }),
    };
    const notificationRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "warning-event-1" }),
    };
    const queuePush = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: true } as any);

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === NotificationEvent) return notificationRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    await TenantLifecycleService.syncTenantState(tenant as any);

    expect(queuePush).not.toHaveBeenCalled();
  });
});
