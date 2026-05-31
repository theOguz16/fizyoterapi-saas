import { Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { User } from "../entities/user.entity";
import { attachAuditError } from "../services/audit-log.service";
import { AuthenticatedRequest } from "./auth.middleware";

export async function activeAccountMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth?.accountId) {
    attachAuditError(res, "ACCOUNT_REQUIRED", "Hesap oturumu bulunamadı. Lütfen tekrar giriş yapın.");
    return res.status(401).json({
      error: { code: "ACCOUNT_REQUIRED", message: "Hesap oturumu bulunamadı. Lütfen tekrar giriş yapın." },
    });
  }

  const account = await AppDataSource.getRepository(Account).findOne({
    where: { id: auth.accountId },
    select: ["id", "is_active"],
  });
  if (!account) {
    attachAuditError(res, "ACCOUNT_NOT_FOUND", "Hesap bulunamadı.");
    return res.status(401).json({
      error: { code: "ACCOUNT_NOT_FOUND", message: "Hesap bulunamadı." },
    });
  }
  if (!account.is_active) {
    attachAuditError(res, "ACCOUNT_INACTIVE", "Hesap aktif değil.");
    return res.status(403).json({
      error: { code: "ACCOUNT_INACTIVE", message: "Hesap aktif değil." },
    });
  }

  if (auth.tenantId && auth.membershipId) {
    const membership = await AppDataSource.getRepository(SalonMembership).findOne({
      where: {
        id: auth.membershipId,
        account_id: auth.accountId,
        tenant_id: auth.tenantId,
        role: auth.role as any,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      },
    });
    if (!membership?.user_id || membership.user_id !== (auth.linkedUserId || auth.sub)) {
      attachAuditError(res, "SESSION_REVOKED", "Oturum yetkisi artık aktif değil. Lütfen tekrar giriş yapın.");
      return res.status(401).json({
        error: { code: "SESSION_REVOKED", message: "Oturum yetkisi artık aktif değil. Lütfen tekrar giriş yapın." },
      });
    }
  }

  if (auth.tenantId) {
    const userId = auth.linkedUserId || auth.sub;
    const user = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: auth.tenantId, id: userId, role: auth.role as any },
      select: ["id", "is_active"],
    });
    if (!user?.is_active) {
      attachAuditError(res, "SESSION_REVOKED", "Oturum yetkisi artık aktif değil. Lütfen tekrar giriş yapın.");
      return res.status(401).json({
        error: { code: "SESSION_REVOKED", message: "Oturum yetkisi artık aktif değil. Lütfen tekrar giriş yapın." },
      });
    }
  }

  return next();
}
