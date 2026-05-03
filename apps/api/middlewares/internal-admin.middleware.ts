// Bu middleware request zincirinde internal admin.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { NextFunction, Request, Response } from "express";
import { attachAuditError } from "../services/audit-log.service";

export function internalAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const configuredSecret = process.env.CLINERVA_ADMIN_SECRET || process.env.JWT_SECRET;
  if (!configuredSecret) {
    attachAuditError(res, "CONFIG_ERROR", "Clinerva yönetici anahtarı tanımlı değil.");
    return res.status(500).json({
      error: { code: "CONFIG_ERROR", message: "Clinerva yönetici anahtarı tanımlı değil." },
    });
  }

  const providedSecret = String(req.headers["x-clinerva-admin-secret"] ?? "").trim();
  if (!providedSecret || providedSecret !== configuredSecret) {
    attachAuditError(res, "INVALID_INTERNAL_ADMIN", "Clinerva yönetici doğrulaması başarısız.");
    return res.status(401).json({
      error: { code: "INVALID_INTERNAL_ADMIN", message: "Clinerva yönetici doğrulaması başarısız." },
    });
  }

  next();
}
