import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { SalonApplication } from "../entities/salon-application.entity";
import {
  MembershipPaymentStatus,
  SalonMembership,
  SalonMembershipStatus,
} from "../entities/salon-membership.entity";
import { Tenant } from "../entities/tenant.entity";
import { UserRole } from "../entities/user.entity";
import { AuditLogService } from "../services/audit-log.service";
import { MemberRequestCleanupService } from "../services/member-request-cleanup.service";
import { hashPassword } from "../services/password.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";

function queryBuilder(result: { many?: unknown[]; one?: unknown }) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
  };
}

describe("AuthController login", () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBcryptRounds = process.env.BCRYPT_ROUNDS;
  let validPasswordHash: string;

  beforeAll(async () => {
    process.env.BCRYPT_ROUNDS = "10";
    validPasswordHash = await hashPassword("correct-password");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "auth-login-test-secret";
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.BCRYPT_ROUNDS = originalBcryptRounds;
  });

  function installBaseRepositories(account: Account | null, options?: {
    memberships?: SalonMembership[];
    tenant?: Tenant | null;
  }) {
    const memberships = options?.memberships ?? [];
    const membershipQuery = queryBuilder({ many: memberships });
    const applicationQuery = queryBuilder({ one: null });
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account) };
    const membershipRepo = { createQueryBuilder: vi.fn().mockReturnValue(membershipQuery) };
    const applicationRepo = { createQueryBuilder: vi.fn().mockReturnValue(applicationQuery) };
    const tenantRepo = {
      findOne: vi.fn().mockImplementation(async (input: any) => {
        if (input?.where?.id) return input.where.id === options?.tenant?.id ? options.tenant : null;
        return null;
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Account) return accountRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      if (entity === SalonApplication) return applicationRepo as any;
      if (entity === Tenant) return tenantRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    return { accountRepo, membershipQuery, applicationQuery, tenantRepo };
  }

  it("selects the requested role membership and returns its tenant-bound session", async () => {
    process.env.JWT_SECRET = "auth-login-test-secret";
    const account = {
      id: "account-1",
      email: "owner@example.com",
      password_hash: validPasswordHash,
      first_name: "Ada",
      last_name: "Yılmaz",
      phone: "5551112233",
      global_role_default: UserRole.ADMIN,
      is_active: true,
    } as Account;
    const adminMembership = {
      id: "membership-admin",
      account_id: account.id,
      tenant_id: "tenant-1",
      user_id: "admin-1",
      role: UserRole.ADMIN,
      status: SalonMembershipStatus.ACTIVE,
      payment_status: MembershipPaymentStatus.VERIFIED,
      is_active_context: true,
    } as SalonMembership;
    const trainerMembership = {
      id: "membership-trainer",
      account_id: account.id,
      tenant_id: "tenant-1",
      user_id: "trainer-1",
      role: UserRole.TRAINER,
      status: SalonMembershipStatus.ACTIVE,
      payment_status: MembershipPaymentStatus.VERIFIED,
      is_active_context: false,
    } as SalonMembership;
    const tenant = { id: "tenant-1", slug: "atlas-fizyo", name: "Atlas Fizyo" } as Tenant;
    const { tenantRepo } = installBaseRepositories(account, {
      memberships: [adminMembership, trainerMembership],
      tenant,
    });
    vi.spyOn(MemberRequestCleanupService, "cleanupStaleApplicationsForAccount").mockResolvedValue(undefined);
    vi.spyOn(MemberRequestCleanupService, "findActionablePaymentRequest").mockResolvedValue(null);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (row) => row as any);
    const auditSpy = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as any);
    const res = { cookie: vi.fn(), json: vi.fn((payload) => payload) } as any;

    await AuthController.login(
      {
        body: { email: " OWNER@EXAMPLE.COM ", password: "correct-password", role: "TRAINER" },
        method: "POST",
        originalUrl: "/api/auth/login",
        headers: { "user-agent": "vitest" },
        ip: "127.0.0.1",
      } as any,
      res
    );

    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: trainerMembership.tenant_id } });
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        onboarding_state: "ACTIVE_SALON",
        available_personas: expect.arrayContaining([UserRole.ADMIN, UserRole.TRAINER]),
        active_membership: expect.objectContaining({
          id: trainerMembership.id,
          role: UserRole.TRAINER,
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          linked_user_id: trainerMembership.user_id,
        }),
        user: expect.objectContaining({
          role: UserRole.TRAINER,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        }),
      }),
    });
    expect(res.cookie).toHaveBeenCalledWith("accessToken", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "AUTH_LOGIN",
      actor_role: UserRole.TRAINER,
      actor_user_id: trainerMembership.user_id,
      tenant_id: tenant.id,
      success: true,
    }));
  });

  it("rejects an invalid password before cleanup, membership lookup and audit", async () => {
    const account = {
      id: "account-1",
      email: "member@example.com",
      password_hash: validPasswordHash,
      is_active: true,
    } as Account;
    const { membershipQuery } = installBaseRepositories(account);
    const cleanupSpy = vi.spyOn(MemberRequestCleanupService, "cleanupStaleApplicationsForAccount");
    const auditSpy = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as any);

    await expect(
      AuthController.login(
        { body: { email: account.email, password: "wrong-password" } } as any,
        {} as any
      )
    ).rejects.toMatchObject({ code: "INVALID_LOGIN", statusCode: 401 });

    expect(cleanupSpy).not.toHaveBeenCalled();
    expect(membershipQuery.getMany).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("rejects an inactive account before cleanup and membership lookup", async () => {
    const account = {
      id: "account-1",
      email: "inactive@example.com",
      password_hash: validPasswordHash,
      is_active: false,
    } as Account;
    const { membershipQuery } = installBaseRepositories(account);
    const cleanupSpy = vi.spyOn(MemberRequestCleanupService, "cleanupStaleApplicationsForAccount");

    await expect(
      AuthController.login(
        { body: { email: account.email, password: "correct-password" } } as any,
        {} as any
      )
    ).rejects.toMatchObject({ code: "USER_INACTIVE", statusCode: 403 });

    expect(cleanupSpy).not.toHaveBeenCalled();
    expect(membershipQuery.getMany).not.toHaveBeenCalled();
  });
});
