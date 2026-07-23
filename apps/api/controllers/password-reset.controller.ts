import crypto from "crypto";
import { IsNull, MoreThan } from "typeorm";
import type { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { AppError } from "../errors/AppError";
import { hashPassword } from "../services/password.service";
import { PasswordResetEmailService } from "../services/password-reset-email.service";
import { AuditLogService } from "../services/audit-log.service";

const RESET_TTL_MS = 30 * 60_000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class PasswordResetController {
  static async request(req: Request, res: Response) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("VALIDATION_ERROR", 422, "Geçerli bir e-posta adresi girilmelidir");
    }

    const account = await AppDataSource.getRepository(Account).findOne({ where: { email, is_active: true } });
    if (account) {
      const token = crypto.randomBytes(32).toString("hex");
      await AppDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PasswordResetToken);
        await repo.update({ account_id: account.id, used_at: IsNull() }, { used_at: new Date() });
        await repo.save(repo.create({
          account_id: account.id,
          token_hash: hashToken(token),
          expires_at: new Date(Date.now() + RESET_TTL_MS),
          used_at: null,
        }));
      });
      try {
        await PasswordResetEmailService.send({ email: account.email, token });
      } catch (error) {
        console.error("Password reset email delivery failed:", error);
      }
      await AuditLogService.log({
        actor_account_id: account.id,
        actor_role: "PUBLIC",
        event_type: "PASSWORD_RESET_REQUESTED",
        action: "PASSWORD_RESET_REQUESTED",
        method: req.method,
        path: req.originalUrl,
        status_code: 202,
        success: true,
        request_id: (req as any).requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
    }

    return res.status(202).json({ data: { accepted: true } });
  }

  static async confirm(req: Request, res: Response) {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token) throw new AppError("RESET_TOKEN_REQUIRED", 422, "Doğrulama kodu zorunludur");
    if (password.length < 8) throw new AppError("WEAK_PASSWORD", 422, "Şifre en az 8 karakter olmalıdır");

    const account = await AppDataSource.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(PasswordResetToken);
      const reset = await tokenRepo.findOne({
        where: { token_hash: hashToken(token), used_at: IsNull(), expires_at: MoreThan(new Date()) },
        lock: { mode: "pessimistic_write" },
      });
      if (!reset) throw new AppError("RESET_TOKEN_INVALID", 400, "Doğrulama kodu geçersiz veya süresi dolmuş");
      const accountRepo = manager.getRepository(Account);
      const activeAccount = await accountRepo.findOne({ where: { id: reset.account_id, is_active: true } });
      if (!activeAccount) throw new AppError("RESET_TOKEN_INVALID", 400, "Doğrulama kodu geçersiz veya süresi dolmuş");

      activeAccount.password_hash = await hashPassword(password);
      activeAccount.auth_version = Number(activeAccount.auth_version || 1) + 1;
      await accountRepo.save(activeAccount);
      reset.used_at = new Date();
      await tokenRepo.save(reset);
      return activeAccount;
    });
    await AuditLogService.log({
      actor_account_id: account.id,
      actor_role: "PUBLIC",
      event_type: "PASSWORD_RESET_COMPLETED",
      action: "PASSWORD_RESET_COMPLETED",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: (req as any).requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    return res.json({ data: { reset: true } });
  }
}
