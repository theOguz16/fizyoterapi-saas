import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountClinicRequestController } from "../controllers/account/clinic-request.controller";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { SalonApplication } from "../entities/salon-application.entity";
import { SalonMembership } from "../entities/salon-membership.entity";
import { SalonProfile } from "../entities/salon-profile.entity";
import { Tenant } from "../entities/tenant.entity";
import { User } from "../entities/user.entity";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("account clinic request controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes owner clinics immediately and activates the admin context", async () => {
    const account = {
      id: "account-1",
      email: "owner@example.com",
      password_hash: "hash",
      first_name: "Owner",
      last_name: "User",
      phone: "05550000000",
      global_role_default: "MEMBER",
    };
    const tenant = {
      id: "tenant-1",
      owner_account_id: "account-1",
      slug: "owner-fizyo",
      name: "Owner Fizyo",
    };
    const profile = { id: "profile-1" };
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue(account),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      create: vi.fn().mockImplementation((input) => ({ ...tenant, ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ ...profile, ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({
        id: input.role === "TRAINER" ? "membership-trainer" : "membership-admin",
        ...input,
      })),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const applicationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({
        id: input.role === "TRAINER" ? "user-trainer" : "user-admin",
        ...input,
      })),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    const getRepository = (entity: any) => {
      if (entity === Account) return accountRepo as any;
      if (entity === Tenant) return tenantRepo as any;
      if (entity === SalonProfile) return profileRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === SalonApplication) return applicationRepo as any;
      if (entity === User) return userRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    };
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({ getRepository }));
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (input) => input as any);
    const productEventSpy = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);

    const res = createMockResponse();
    await AccountClinicRequestController.createOrUpdate(
      {
        auth: { accountId: "account-1" },
        method: "POST",
        originalUrl: "/api/account/clinic-request",
        headers: { "x-fizyoflow-funnel-id": "funnel-1" },
        body: {
          clinic_name: "Owner Fizyo",
          city: "Bursa",
          district: "Karacabey",
          phone: "05550000000",
          about_text: "Klinik aciklamasi",
        },
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(tenantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: "PUBLISHED",
        subscription_status: "TRIAL",
        is_public: true,
        trial_starts_at: expect.any(Date),
        trial_ends_at: expect.any(Date),
        subscription_started_at: expect.any(Date),
        subscription_current_period_ends_at: expect.any(Date),
      })
    );
    const savedTrialTenant = tenantRepo.save.mock.calls
      .map(([input]) => input)
      .find((input) => input.trial_starts_at && input.trial_ends_at);
    expect((savedTrialTenant.trial_ends_at.getTime() - savedTrialTenant.trial_starts_at.getTime()) / (24 * 60 * 60 * 1000)).toBeCloseTo(21, 4);
    expect(profileRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_published: true }));
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        email: "owner@example.com",
        role: "ADMIN",
        is_active: true,
      })
    );
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-trainer",
        tenant_id: "tenant-1",
        email: "owner@example.com",
        role: "TRAINER",
        is_active: true,
      })
    );
    expect(membershipRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        account_id: "account-1",
        user_id: "user-admin",
        role: "ADMIN",
        status: "ACTIVE",
        payment_status: "VERIFIED",
        is_active_context: true,
      })
    );
    expect(membershipRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        account_id: "account-1",
        user_id: "user-trainer",
        role: "TRAINER",
        status: "ACTIVE",
        payment_status: "VERIFIED",
        is_active_context: false,
      })
    );
    expect((res.body as any).data).toEqual(
      expect.objectContaining({
        id: "tenant-1",
        review_status: "PUBLISHED",
        subscription_status: "TRIAL",
        is_public: true,
        trial_starts_at: expect.any(Date),
        trial_ends_at: expect.any(Date),
        owner_is_practitioner: true,
        owner_trainer_user_id: "user-trainer",
      })
    );
    expect(productEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "clinic_created", tenant_id: "tenant-1", actor_account_id: "account-1", funnel_id: "funnel-1" }),
      expect.anything()
    );
    expect(productEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "trial_started", tenant_id: "tenant-1", actor_account_id: "account-1", funnel_id: "funnel-1" }),
      expect.anything()
    );
  });

  it("does not create a trainer context when the owner opts out", async () => {
    const account = {
      id: "account-1",
      email: "owner@example.com",
      password_hash: "hash",
      first_name: "Owner",
      last_name: "User",
      phone: "05550000000",
      global_role_default: "MEMBER",
    };
    const tenant = {
      id: "tenant-1",
      owner_account_id: "account-1",
      slug: "owner-fizyo",
      name: "Owner Fizyo",
    };
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue(account),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      create: vi.fn().mockImplementation((input) => ({ ...tenant, ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "profile-1", ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "membership-admin", ...input })),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const applicationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "user-admin", ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const getRepository = (entity: any) => {
      if (entity === Account) return accountRepo as any;
      if (entity === Tenant) return tenantRepo as any;
      if (entity === SalonProfile) return profileRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === SalonApplication) return applicationRepo as any;
      if (entity === User) return userRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    };
    const transaction = vi
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback: any) => callback({ getRepository }));
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (input) => input as any);
    vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);

    const res = createMockResponse();
    await AccountClinicRequestController.createOrUpdate(
      {
        auth: { accountId: "account-1" },
        body: {
          clinic_name: "Owner Fizyo",
          city: "Bursa",
          district: "Karacabey",
          phone: "05550000000",
          about_text: "Klinik aciklamasi",
          owner_is_practitioner: false,
        },
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(transaction).toHaveBeenCalledOnce();
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
    expect(membershipRepo.save).toHaveBeenCalledTimes(1);
    expect(membershipRepo.save).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
    expect((res.body as any).data).toEqual(
      expect.objectContaining({
        owner_is_practitioner: false,
        owner_trainer_user_id: null,
      })
    );
  });

  it("keeps an active subscription active when an existing owner saves clinic details again", async () => {
    const account = {
      id: "account-1",
      email: "owner@example.com",
      password_hash: "hash",
      first_name: "Owner",
      last_name: "User",
      phone: "05550000000",
      global_role_default: "ADMIN",
    };
    const tenant = {
      id: "tenant-1",
      owner_account_id: account.id,
      slug: "owner-fizyo",
      name: "Owner Fizyo",
      review_status: "PUBLISHED",
      subscription_status: "ACTIVE",
      is_public: true,
      trial_starts_at: new Date("2026-01-01T00:00:00.000Z"),
      trial_ends_at: new Date("2026-01-22T00:00:00.000Z"),
      subscription_started_at: new Date("2026-01-01T00:00:00.000Z"),
      subscription_current_period_ends_at: new Date("2026-08-01T00:00:00.000Z"),
    };
    const adminUser = { id: "user-admin", tenant_id: tenant.id, email: account.email, role: "ADMIN", is_active: true };
    const adminMembership = {
      id: "membership-admin",
      account_id: account.id,
      tenant_id: tenant.id,
      user_id: adminUser.id,
      role: "ADMIN",
      status: "ACTIVE",
      payment_status: "VERIFIED",
      is_active_context: true,
    };
    const profile = {
      id: "profile-1",
      tenant_id: tenant.id,
      slug: tenant.slug,
      location: { city: "Bursa", district: "Nilüfer" },
      service_area: ["Bursa", "Nilüfer"],
      is_published: true,
    };
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account), save: vi.fn(async (value) => value) };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValueOnce(tenant).mockResolvedValueOnce(tenant),
      save: vi.fn(async (value) => value),
    };
    const profileRepo = { findOne: vi.fn().mockResolvedValue(profile), save: vi.fn(async (value) => value) };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValueOnce(adminMembership).mockResolvedValueOnce(adminMembership),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }),
      save: vi.fn(async (value) => value),
    };
    const applicationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };
    const userRepo = { findOne: vi.fn().mockResolvedValue(adminUser), save: vi.fn(async (value) => value) };
    const getRepository = (entity: any) => {
      if (entity === Account) return accountRepo as any;
      if (entity === Tenant) return tenantRepo as any;
      if (entity === SalonProfile) return profileRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === SalonApplication) return applicationRepo as any;
      if (entity === User) return userRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    };
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({ getRepository }));
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (value) => value as any);
    const productEvent = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);
    const res = createMockResponse();

    await AccountClinicRequestController.createOrUpdate({
      auth: { accountId: account.id },
      body: {
        clinic_name: "Owner Fizyo Güncel",
        city: "Bursa",
        district: "Nilüfer",
        phone: "05550000000",
        about_text: "Güncel klinik açıklaması",
        owner_is_practitioner: false,
      },
    } as any, res as any);

    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenant.subscription_current_period_ends_at).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(tenantRepo.save).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "ACTIVE" }));
    expect(productEvent).not.toHaveBeenCalledWith(expect.objectContaining({ event_name: "trial_started" }), expect.anything());
    expect(res.statusCode).toBe(201);
  });
});
