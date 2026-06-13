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
    const linkedUser = { id: "user-1" };
    const membership = { id: "membership-1" };

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
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      create: vi.fn().mockImplementation((input) => ({ ...membership, ...input })),
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
      create: vi.fn().mockImplementation((input) => ({ ...linkedUser, ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Account) return accountRepo as any;
      if (entity === Tenant) return tenantRepo as any;
      if (entity === SalonProfile) return profileRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === SalonApplication) return applicationRepo as any;
      if (entity === User) return userRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (input) => input as any);

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
    expect(profileRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_published: true }));
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        email: "owner@example.com",
        role: "ADMIN",
        is_active: true,
      })
    );
    expect(membershipRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        account_id: "account-1",
        user_id: "user-1",
        role: "ADMIN",
        status: "ACTIVE",
        payment_status: "VERIFIED",
        is_active_context: true,
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
      })
    );
  });
});
