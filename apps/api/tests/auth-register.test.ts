import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { AppError } from "../errors/AppError";
import { UserRole } from "../entities/user.entity";
import { AuditLogService } from "../services/audit-log.service";

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
});
