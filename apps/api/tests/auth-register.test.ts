import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { AppError } from "../errors/AppError";
import { UserRole } from "../entities/user.entity";
import { Account } from "../entities/account.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AuditLogService } from "../services/audit-log.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { LEGAL_DOCUMENT_VERSION } from "@fitnes-saas/contracts";

const legalConsent = {
  terms_accepted: true,
  privacy_notice_acknowledged: true,
  marketing_consent: false,
  document_version: LEGAL_DOCUMENT_VERSION,
};

describe("auth public register", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects member self-signup outside clinic QR, link or invite flows", async () => {
    const req = {
      body: {
        email: "member@example.com",
        password: "strong-pass",
        first_name: "Test",
        last_name: "Member",
        phone: "05550000000",
        account_type: "MEMBER",
      },
    } as any;

    await expect(AuthController.register(req, {} as any)).rejects.toEqual(
      expect.objectContaining<AppError>({
        code: "SELF_SIGNUP_ROLE_RESTRICTED",
        statusCode: 422,
      })
    );
  });

  it("creates an admin account for the default public signup", async () => {
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((input) => ({ id: "account-1", ...input })),
      save: vi.fn(async (input) => input),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(accountRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      body: {
        email: "owner@example.com",
        password: "strong-pass",
        first_name: "Clinic",
        last_name: "Owner",
        phone: "05550000000",
        onboarding_profile: {
          role: "MEMBER",
          primary_goal: "operations",
          rhythm: "steady",
          support_style: "control",
        },
        legal_consent: legalConsent,
      },
      method: "POST",
      originalUrl: "/api/auth/register",
      headers: {},
      ip: "127.0.0.1",
    } as any;
    const res = {
      cookie: vi.fn(),
      json: vi.fn((payload) => payload),
    } as any;

    await AuthController.register(req, res);

    expect(accountRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        global_role_default: UserRole.ADMIN,
        onboarding_profile: expect.objectContaining({ role: UserRole.ADMIN }),
        legal_consents: expect.objectContaining({
          source: "MOBILE_CLINIC_OWNER_REGISTER",
          marketing: expect.objectContaining({ granted: false }),
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_state: "NO_CLINIC",
          user: expect.objectContaining({ role: UserRole.ADMIN }),
        }),
      })
    );
  });

  it("creates a member account only inside a published clinic join flow", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "demo-clinic",
      name: "Demo Clinic",
      is_active: true,
      is_public: true,
      review_status: TenantReviewStatus.PUBLISHED,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
    } as Tenant;
    const tenantRepo = { findOne: vi.fn().mockResolvedValue(tenant) };
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((input) => ({ id: "member-account-1", ...input })),
      save: vi.fn(async (input) => input),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Tenant) return tenantRepo as any;
      if (entity === Account) return accountRepo as any;
      throw new Error(`Unexpected repository: ${entity?.name || entity}`);
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue(tenant);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      body: {
        email: "member@example.com",
        password: "strong-pass",
        first_name: "Test",
        last_name: "Member",
        phone: "05550000000",
        tenant_slug: "demo-clinic",
        join_source: "QR",
        legal_consent: { ...legalConsent, marketing_consent: true },
      },
      method: "POST",
      originalUrl: "/api/auth/register-clinic-member",
      headers: {},
      ip: "127.0.0.1",
    } as any;
    const res = { cookie: vi.fn(), json: vi.fn((payload) => payload) } as any;

    await AuthController.registerClinicMember(req, res);

    expect(accountRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        global_role_default: UserRole.MEMBER,
        legal_consents: expect.objectContaining({
          source: "MOBILE_CLINIC_MEMBER_REGISTER",
          marketing: expect.objectContaining({ granted: true }),
        }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_state: "NO_SALON",
          has_active_membership: false,
          user: expect.objectContaining({ role: UserRole.MEMBER }),
        }),
      })
    );
  });

  it("rejects clinic-bound member registration for an unpublished clinic", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "hidden-clinic",
      is_active: true,
      is_public: false,
      review_status: TenantReviewStatus.PENDING_REVIEW,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
    } as Tenant;
    const tenantRepo = { findOne: vi.fn().mockResolvedValue(tenant) };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue(tenant);

    await expect(
      AuthController.registerClinicMember(
        {
          body: {
            email: "member@example.com",
            password: "strong-pass",
            first_name: "Test",
            last_name: "Member",
            phone: "05550000000",
            tenant_slug: "hidden-clinic",
            legal_consent: legalConsent,
          },
        } as any,
        {} as any
      )
    ).rejects.toEqual(expect.objectContaining<AppError>({ code: "SALON_NOT_PUBLIC", statusCode: 409 }));
  });

  it("rejects registration when mandatory legal declarations are missing", async () => {
    const baseRequest = {
      body: {
        email: "owner@example.com",
        password: "strong-pass",
        first_name: "Clinic",
        last_name: "Owner",
        phone: "05550000000",
        account_type: "CLINIC_ADMIN",
      },
    } as any;

    await expect(AuthController.register(baseRequest, {} as any)).rejects.toEqual(
      expect.objectContaining<AppError>({ code: "TERMS_REQUIRED", statusCode: 422 })
    );

    baseRequest.body.legal_consent = {
      ...legalConsent,
      privacy_notice_acknowledged: false,
    };
    await expect(AuthController.register(baseRequest, {} as any)).rejects.toEqual(
      expect.objectContaining<AppError>({ code: "PRIVACY_NOTICE_REQUIRED", statusCode: 422 })
    );
  });

  it("rejects a stale legal document version", async () => {
    const req = {
      body: {
        email: "owner@example.com",
        password: "strong-pass",
        first_name: "Clinic",
        last_name: "Owner",
        phone: "05550000000",
        account_type: "CLINIC_ADMIN",
        legal_consent: { ...legalConsent, document_version: "stale-version" },
      },
    } as any;

    await expect(AuthController.register(req, {} as any)).rejects.toEqual(
      expect.objectContaining<AppError>({ code: "LEGAL_DOCUMENT_VERSION_MISMATCH", statusCode: 409 })
    );
  });
});
