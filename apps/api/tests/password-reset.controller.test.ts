import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { PasswordResetController } from "../controllers/password-reset.controller";
import { PasswordResetEmailService } from "../services/password-reset-email.service";
import { AuditLogService } from "../services/audit-log.service";
import { verifyPassword } from "../services/password.service";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn((payload) => payload),
  } as any;
}

function request(body: Record<string, unknown>) {
  return {
    body,
    method: "POST",
    originalUrl: "/api/auth/password-reset",
    headers: { "user-agent": "vitest" },
    ip: "127.0.0.1",
  } as any;
}

describe("PasswordResetController", () => {
  beforeEach(() => {
    process.env.BCRYPT_ROUNDS = "10";
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns the same accepted response for an unknown account without creating a token", async () => {
    const accountRepo = { findOne: vi.fn().mockResolvedValue(null) };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(accountRepo as any);
    const transaction = vi.spyOn(AppDataSource, "transaction");
    const send = vi.spyOn(PasswordResetEmailService, "send");
    const res = response();

    await PasswordResetController.request(request({ email: "unknown@example.com" }), res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ data: { accepted: true } });
    expect(transaction).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("invalidates old tokens, stores only a token hash and sends the raw token", async () => {
    const account = { id: "account-1", email: "owner@example.com", is_active: true } as Account;
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account) };
    const tokenRepo = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(accountRepo as any);
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({
      getRepository: (entity: unknown) => entity === PasswordResetToken ? tokenRepo : accountRepo,
    }));
    const send = vi.spyOn(PasswordResetEmailService, "send").mockResolvedValue({ configured: true, delivered: true });

    await PasswordResetController.request(request({ email: " OWNER@EXAMPLE.COM " }), response());

    const rawToken = send.mock.calls[0][0].token;
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenRepo.update).toHaveBeenCalledOnce();
    expect(tokenRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: account.id,
      token_hash: crypto.createHash("sha256").update(rawToken).digest("hex"),
      used_at: null,
    }));
    expect(tokenRepo.create.mock.calls[0][0].token_hash).not.toBe(rawToken);
  });

  it("atomically changes the password, consumes the token and increments auth version", async () => {
    const reset = {
      id: "reset-1",
      account_id: "account-1",
      token_hash: "stored-hash",
      expires_at: new Date(Date.now() + 60_000),
      used_at: null,
    } as PasswordResetToken;
    const account = {
      id: "account-1",
      email: "owner@example.com",
      password_hash: "old-hash",
      auth_version: 4,
      is_active: true,
    } as Account;
    const tokenRepo = { findOne: vi.fn().mockResolvedValue(reset), save: vi.fn(async (value) => value) };
    const accountRepo = { findOne: vi.fn().mockResolvedValue(account), save: vi.fn(async (value) => value) };
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({
      getRepository: (entity: unknown) => entity === PasswordResetToken ? tokenRepo : accountRepo,
    }));
    const res = response();

    await PasswordResetController.confirm(request({ token: "single-use-token", password: "new-password-123" }), res);

    expect(account.auth_version).toBe(5);
    expect(await verifyPassword("new-password-123", account.password_hash)).toBe(true);
    expect(reset.used_at).toBeInstanceOf(Date);
    expect(tokenRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: "pessimistic_write" } }));
    expect(res.json).toHaveBeenCalledWith({ data: { reset: true } });
  });

  it("rejects missing, weak and invalid reset credentials", async () => {
    await expect(PasswordResetController.confirm(request({ password: "strong-pass" }), response()))
      .rejects.toMatchObject({ code: "RESET_TOKEN_REQUIRED", statusCode: 422 });
    await expect(PasswordResetController.confirm(request({ token: "token", password: "short" }), response()))
      .rejects.toMatchObject({ code: "WEAK_PASSWORD", statusCode: 422 });

    const tokenRepo = { findOne: vi.fn().mockResolvedValue(null) };
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({
      getRepository: () => tokenRepo,
    }));
    await expect(PasswordResetController.confirm(request({ token: "expired", password: "strong-pass" }), response()))
      .rejects.toMatchObject({ code: "RESET_TOKEN_INVALID", statusCode: 400 });
  });
});
