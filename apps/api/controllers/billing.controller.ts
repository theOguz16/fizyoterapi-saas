// Bu controller genel tarafindaki billing.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { AppDataSource } from "../data-source";
import { Tenant, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AppError } from "../errors/AppError";
import { AuditLogService } from "../services/audit-log.service";

export class BillingController {
  static async createSubscriptionIntent(req: Request, res: Response) {
    const planId = String(req.body?.plan_id || "").trim() || "balance";
    await AuditLogService.log({
      actor_role: "PUBLIC",
      event_type: "BILLING_SUBSCRIPTION_INTENT_CREATED",
      action: "BILLING_SUBSCRIPTION_INTENT_CREATED",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "billing_plan",
      target_id: planId,
      metadata: { plan_id: planId },
    });

    return res.json({
      data: {
        status: "PENDING_CONTACT",
        plan_id: planId,
        message: "Plan talebin alindi. Odeme ve aktivasyon adimi icin ekibimiz seninle iletisime gececek.",
      },
    });
  }

  static async revenueCatWebhook(req: Request, res: Response) {
    const configuredAuth = String(process.env.REVENUECAT_WEBHOOK_AUTH || "").trim();
    const incomingAuth = String(req.headers.authorization || "").trim();

    if (!configuredAuth && process.env.NODE_ENV === "production") {
      throw new AppError("REVENUECAT_WEBHOOK_AUTH_MISSING", 500, "RevenueCat webhook anahtarı tanımlı değil");
    }

    const configured = Buffer.from(configuredAuth);
    const incoming = Buffer.from(incomingAuth);
    const isAuthorized =
      !configuredAuth || (incoming.length === configured.length && timingSafeEqual(incoming, configured));
    if (!isAuthorized) {
      throw new AppError("REVENUECAT_UNAUTHORIZED", 401, "RevenueCat webhook yetkisi gecersiz");
    }

    const payload = (req.body || {}) as {
      api_version?: string;
      event?: {
        type?: string;
        app_user_id?: string | null;
        original_app_user_id?: string | null;
        entitlement_ids?: string[] | null;
        product_id?: string | null;
        period_type?: string | null;
        store?: string | null;
      };
    };

    const event = payload.event || {};
    const tenantId = String(event.app_user_id || event.original_app_user_id || "").trim();
    const eventType = String(event.type || "UNKNOWN").trim();
    const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
    const expectedEntitlement = String(process.env.REVENUECAT_ENTITLEMENT_ID || "clinic_pro").trim();

    if (!tenantId) {
      throw new AppError("REVENUECAT_TENANT_NOT_RESOLVED", 422, "RevenueCat app_user_id gerekli");
    }

    if (expectedEntitlement && entitlementIds.length > 0 && !entitlementIds.includes(expectedEntitlement)) {
      await AuditLogService.log({
        actor_role: "SYSTEM",
        event_type: "REVENUECAT_WEBHOOK_IGNORED",
        action: "REVENUECAT_WEBHOOK_IGNORED",
        method: req.method,
        path: req.originalUrl,
        status_code: 202,
        success: true,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "tenant",
        target_id: tenantId,
        metadata: {
          expected_entitlement: expectedEntitlement,
          entitlement_ids: entitlementIds,
          revenuecat_event_type: eventType,
        },
      });
      return res.status(202).json({ ok: true, ignored: true });
    }

    const repo = AppDataSource.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new AppError("REVENUECAT_TENANT_NOT_FOUND", 404, "RevenueCat webhook tenant bulamadi");
    }

    if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL" || eventType === "UNCANCELLATION") {
      const isTrial = String(event.period_type || "").toUpperCase() === "TRIAL";
      tenant.subscription_status = isTrial ? TenantSubscriptionStatus.TRIAL : TenantSubscriptionStatus.ACTIVE;
      tenant.is_public = true;
      await repo.save(tenant);
    }

    if (eventType === "EXPIRATION") {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      await repo.save(tenant);
    }

    await AuditLogService.log({
      tenant_id: tenant.id,
      actor_role: "SYSTEM",
      event_type: "REVENUECAT_WEBHOOK_RECEIVED",
      action: eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "tenant",
      target_id: tenant.id,
      metadata: {
        api_version: payload.api_version || null,
        entitlement_ids: entitlementIds,
        period_type: event.period_type || null,
        product_id: event.product_id || null,
        revenuecat_event_type: eventType,
        store: event.store || null,
        subscription_status: tenant.subscription_status,
      },
    });

    return res.json({ ok: true });
  }
}
