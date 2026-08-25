import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import * as passwordService from "../services/password.service";

describe("authenticated password change", () => {
  afterEach(() => vi.restoreAllMocks());

  it("verifies the current password, rotates auth version and audits the change", async () => {
    const account = { id: "account-1", is_active: true, password_hash: "old-hash", auth_version: 3 };
    const repo = { findOne: vi.fn().mockResolvedValue(account), save: vi.fn(async (value) => value) };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);
    vi.spyOn(passwordService, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(passwordService, "hashPassword").mockResolvedValue("new-hash");
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    const req = {
      auth: { accountId: "account-1", loginScope: "ACCOUNT", role: "MEMBER", tenantId: "tenant-1" },
      body: { current_password: "old-password", new_password: "new-password" },
      method: "POST",
      originalUrl: "/api/auth/change-password",
      headers: {},
      ip: "127.0.0.1",
    } as any;
    const res = { clearCookie: vi.fn(), json: vi.fn((value) => value) } as any;

    await AuthController.changePassword(req, res);

    expect(passwordService.verifyPassword).toHaveBeenCalledWith("old-password", "old-hash");
    expect(account).toMatchObject({ password_hash: "new-hash", auth_version: 4 });
    expect(repo.save).toHaveBeenCalledWith(account);
    expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: "AUTH_PASSWORD_CHANGED", success: true }));
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: true });
  });

  it("rejects an incorrect current password without changing the account", async () => {
    const account = { id: "account-1", is_active: true, password_hash: "old-hash", auth_version: 1 };
    const repo = { findOne: vi.fn().mockResolvedValue(account), save: vi.fn() };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);
    vi.spyOn(passwordService, "verifyPassword").mockResolvedValue(false);

    await expect(AuthController.changePassword({
      auth: { accountId: "account-1", loginScope: "ACCOUNT", role: "MEMBER" },
      body: { current_password: "wrong", new_password: "new-password" },
    } as any, {} as any)).rejects.toMatchObject({ code: "INVALID_CURRENT_PASSWORD", statusCode: 401 });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
