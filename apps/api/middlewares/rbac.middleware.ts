// Bu middleware request zincirinde rbac.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { Request, Response, NextFunction } from "express";
import { attachAuditError } from "../services/audit-log.service";

export function requireRole(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).auth?.role;
    if (!role || !allowed.includes(role)) {
      attachAuditError(res, "FORBIDDEN", "Bu işlem için yetkiniz bulunmuyor.");
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Bu işlem için yetkiniz bulunmuyor." },
      });
    }
    next();
  };
}
