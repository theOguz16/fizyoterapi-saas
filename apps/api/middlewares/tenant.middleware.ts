// Bu middleware request zincirinde tenant.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Tenant, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AuthenticatedRequest } from "./auth.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { attachAuditError } from "../services/audit-log.service";

export async function tenantMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth?.tenantId) {
    attachAuditError(
      res,
      auth?.role === "MEMBER" ? "NO_ACTIVE_SALON" : "NO_TENANT",
      auth?.role === "MEMBER" ? "Aktif salon bulunamadı. Önce bir salona katılın." : "Klinik bilgisi çözümlenemedi."
    );
    return res.status(auth?.role === "MEMBER" ? 403 : 400).json({
      error: {
        code: auth?.role === "MEMBER" ? "NO_ACTIVE_SALON" : "NO_TENANT",
        message: auth?.role === "MEMBER" ? "Aktif salon bulunamadı. Önce bir salona katılın." : "Klinik bilgisi çözümlenemedi.",
      },
    });
  }

  const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { id: auth.tenantId } });
  const syncedTenant = await TenantLifecycleService.syncTenantState(tenant);
  if (!syncedTenant || !syncedTenant.is_active) {
    attachAuditError(res, "TENANT_INACTIVE", "Klinik kullanıma kapalı.");
    return res.status(403).json({
      error: {
        code: "TENANT_INACTIVE",
        message: "Klinik kullanıma kapalı.",
      },
    });
  }

  if (
    syncedTenant.subscription_status === TenantSubscriptionStatus.READ_ONLY &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())
  ) {
    attachAuditError(res, "TENANT_READ_ONLY", "Deneme süresi dolduğu için klinik salt-okunur moda geçti.");
    return res.status(403).json({
      error: {
        code: "TENANT_READ_ONLY",
        message: "Deneme süresi dolduğu için klinik salt-okunur moda geçti.",
      },
    });
  }

  req.tenantId = auth.tenantId;
  next();
}
