import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AppDataSource } from "../data-source";

describe("auth version revocation", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "auth-version-test-secret";
  });

  afterEach(() => vi.restoreAllMocks());

  function request(token: string) {
    return { headers: { authorization: `Bearer ${token}` }, cookies: {} } as any;
  }

  function response() {
    return {
      statusCode: 200,
      status: vi.fn(function (this: any, value: number) { this.statusCode = value; return this; }),
      json: vi.fn((value) => value),
    } as any;
  }

  it("accepts a pre-version account token only while the account is still version 1", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "account-1", auth_version: 1, is_active: true }),
    } as any);
    const token = jwt.sign({ sub: "account-1", accountId: "account-1", loginScope: "ACCOUNT", role: "ADMIN" }, process.env.JWT_SECRET!);
    const next = vi.fn();

    await authMiddleware(request(token), response(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an old token after password reset increments the account version", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "account-1", auth_version: 2, is_active: true }),
    } as any);
    const token = jwt.sign({ sub: "account-1", accountId: "account-1", loginScope: "ACCOUNT", role: "ADMIN", authVersion: 1 }, process.env.JWT_SECRET!);
    const res = response();
    const next = vi.fn();

    await authMiddleware(request(token), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "SESSION_REVOKED" }),
    });
  });
});
