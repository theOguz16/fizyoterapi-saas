import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import {
  MembershipPaymentStatus,
  SalonMembership,
  SalonMembershipStatus,
} from "../entities/salon-membership.entity";
import { Tenant } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { internalE2ERoutes } from "../routes/internal/e2e.route";

function routeHandlers() {
  const stack = (internalE2ERoutes as any).stack as Array<any>;
  const environmentGate = stack.find((layer) => !layer.route)?.handle;
  const sessionLayer = stack.find((layer) => layer.route?.path === "/session");
  return {
    environmentGate,
    session: sessionLayer?.route?.stack?.[0]?.handle,
  };
}

async function invokeSession(body: Record<string, unknown>) {
  const { session } = routeHandlers();
  const next = vi.fn();
  const req = { body } as any;
  const res = {} as any;
  await session(req, res, next);
  return { next, req, res };
}

describe("internal E2E persona route", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("is unavailable in production before any persona setup runs", () => {
    process.env.NODE_ENV = "production";
    const { environmentGate } = routeHandlers();
    const repoSpy = vi.spyOn(AppDataSource, "getRepository");

    expect(() => environmentGate({} as any, {} as any, vi.fn())).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND", statusCode: 404 })
    );
    expect(repoSpy).not.toHaveBeenCalled();
  });

  it.each([
    [UserRole.ADMIN, "5550099001", null],
    [UserRole.TRAINER, "5550099002", null],
    [UserRole.MEMBER, "5550099003", 1],
  ] as const)("creates and activates a deterministic %s persona before login", async (role, phone, weeklyClassHours) => {
    process.env.NODE_ENV = "test";
    const tenant = { id: "tenant-1", slug: "demo-salon", owner_account_id: null } as Tenant;
    const account = {
      id: `account-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@e2e.test`,
      password_hash: "existing-password-hash",
    } as Account;
    const savedUser = { id: `user-${role.toLowerCase()}` } as User;
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockResolvedValue(tenant),
    };
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account) };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(savedUser),
    };
    const execute = vi.fn().mockResolvedValue({ affected: 1 });
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockImplementation(async (value) => value),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute,
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      if (entity === Account) return accountRepo as any;
      if (entity === User) return userRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    const loginSpy = vi.spyOn(AuthController, "login").mockResolvedValue({ ok: true } as any);

    const body = {
      email: account.email.toUpperCase(),
      password: "E2e-password-123",
      role: role.toLowerCase(),
    };
    const { next, req, res } = await invokeSession(body);

    expect(next).not.toHaveBeenCalled();
    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { slug: "demo-salon" } });
    expect(accountRepo.findOne).toHaveBeenCalledWith({ where: { email: account.email } });
    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { tenant_id: tenant.id, email: account.email, role },
    });
    expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: tenant.id,
      email: account.email,
      password_hash: account.password_hash,
      role,
      phone,
      qr_code: `E2E-${role}-PERSONA`,
      weekly_class_hours: weeklyClassHours,
      is_active: true,
    }));
    expect(membershipRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: account.id,
      tenant_id: tenant.id,
      user_id: savedUser.id,
      role,
      status: SalonMembershipStatus.ACTIVE,
      payment_status: MembershipPaymentStatus.VERIFIED,
      is_active_context: true,
    }));
    expect(execute).toHaveBeenCalledOnce();
    expect(loginSpy).toHaveBeenCalledWith(req, res);

    if (role === UserRole.ADMIN) {
      expect(tenant.owner_account_id).toBe(account.id);
      expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
    } else {
      expect(tenantRepo.save).not.toHaveBeenCalled();
    }
  });

  it("reactivates an existing membership and selects the requested tenant context", async () => {
    const tenant = { id: "tenant-2", slug: "atlas-fizyo", owner_account_id: "owner-1" } as Tenant;
    const account = { id: "account-1", email: "trainer@e2e.test", password_hash: "hash" } as Account;
    const user = { id: "trainer-1", role: UserRole.TRAINER } as User;
    const membership = {
      account_id: account.id,
      tenant_id: tenant.id,
      user_id: null,
      role: UserRole.TRAINER,
      status: SalonMembershipStatus.LEFT,
      payment_status: MembershipPaymentStatus.UNPAID,
      is_active_context: false,
      joined_at: null,
      left_at: new Date("2026-01-01T00:00:00.000Z"),
    } as SalonMembership;
    const execute = vi.fn().mockResolvedValue({ affected: 2 });
    const tenantRepo = { findOne: vi.fn().mockResolvedValue(tenant), save: vi.fn() };
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account) };
    const userRepo = { findOne: vi.fn().mockResolvedValue(user), create: vi.fn(), save: vi.fn() };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue(membership),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (value) => value),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute,
      }),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      if (entity === Account) return accountRepo as any;
      if (entity === User) return userRepo as any;
      if (entity === SalonMembership) return membershipRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    vi.spyOn(AuthController, "login").mockResolvedValue({ ok: true } as any);

    const { next } = await invokeSession({
      email: account.email,
      password: "E2e-password-123",
      role: "TRAINER",
      tenant_slug: " ATLAS-FIZYO ",
    });

    expect(next).not.toHaveBeenCalled();
    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { slug: "atlas-fizyo" } });
    expect(membershipRepo.create).not.toHaveBeenCalled();
    expect(membershipRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      user_id: user.id,
      status: SalonMembershipStatus.ACTIVE,
      payment_status: MembershipPaymentStatus.VERIFIED,
      is_active_context: true,
      left_at: null,
      joined_at: expect.any(Date),
    }));
    expect(execute).toHaveBeenCalledOnce();
  });

  it("returns a deterministic error and skips login when the requested tenant is missing", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return { findOne: vi.fn().mockResolvedValue(null) } as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    const loginSpy = vi.spyOn(AuthController, "login").mockResolvedValue({ ok: true } as any);

    const { next } = await invokeSession({
      email: "member@e2e.test",
      password: "E2e-password-123",
      role: "MEMBER",
      tenantSlug: "missing-clinic",
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: "E2E_TENANT_NOT_FOUND",
      statusCode: 404,
    }));
    expect(loginSpy).not.toHaveBeenCalled();
  });
});
