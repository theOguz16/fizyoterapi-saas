// Bu middleware request zincirinde internal admin.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { attachAuditError } from "../services/audit-log.service";

export function internalAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const configuredSecret =
    process.env.FIZYOFLOW_ADMIN_SECRET || (process.env.NODE_ENV === "production" ? undefined : process.env.JWT_SECRET);
  if (!configuredSecret) {
    attachAuditError(res, "CONFIG_ERROR", "FizyoFlow yönetici anahtarı tanımlı değil.");
    return res.status(500).json({
      error: { code: "CONFIG_ERROR", message: "FizyoFlow yönetici anahtarı tanımlı değil." },
    });
  }

  const providedSecret = String(req.headers?.["x-fizyoflow-admin-secret"] ?? "").trim();
  const provided = Buffer.from(providedSecret);
  const configured = Buffer.from(configuredSecret);
  const isValid = provided.length === configured.length && timingSafeEqual(provided, configured);
  if (!providedSecret || !isValid) {
    attachAuditError(res, "INVALID_INTERNAL_ADMIN", "FizyoFlow yönetici doğrulaması başarısız.");
    return res.status(401).json({
      error: { code: "INVALID_INTERNAL_ADMIN", message: "FizyoFlow yönetici doğrulaması başarısız." },
    });
  }

  next();
}
