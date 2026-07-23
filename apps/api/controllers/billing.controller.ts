// Bu controller genel tarafindaki billing.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { AppDataSource } from "../data-source";
import { Tenant, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AppError } from "../errors/AppError";
import { AuditLogService } from "../services/audit-log.service";

const REVENUECAT_ACTIVE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]);
const REVENUECAT_EXPIRATION_EVENTS = new Set(["EXPIRATION"]);
const REVENUECAT_NON_REVOKING_EVENTS = new Set(["BILLING_ISSUE", "CANCELLATION"]);

function dateFromRevenueCatMs(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric);
}

function latestDate(...dates: Array<Date | null | undefined>) {
  const valid = dates.filter((date): date is Date => Boolean(date && Number.isFinite(date.getTime())));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function keepFutureDate(date: Date | null | undefined) {
  if (!date) return null;
  const value = new Date(date);
  return value.getTime() > Date.now() ? value : null;
}

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
        event_timestamp_ms?: number | string | null;
        purchased_at_ms?: number | string | null;
        expiration_at_ms?: number | string | null;
        transaction_id?: string | null;
        original_transaction_id?: string | null;
      };
    };

    const event = payload.event || {};
    const tenantId = String(event.app_user_id || event.original_app_user_id || "").trim();
    const eventType = String(event.type || "UNKNOWN").trim().toUpperCase();
    const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
    const expectedEntitlement = String(process.env.REVENUECAT_ENTITLEMENT_ID || "clinic_pro").trim();
    const eventAt = dateFromRevenueCatMs(event.event_timestamp_ms) || new Date();
    const purchasedAt = dateFromRevenueCatMs(event.purchased_at_ms);
    const expirationAt = dateFromRevenueCatMs(event.expiration_at_ms);
    const activeUntil = latestDate(expirationAt, purchasedAt);
    const primaryEntitlement = entitlementIds[0] || expectedEntitlement || null;

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

    const lastEventAt = tenant.subscription_last_event_at ? new Date(tenant.subscription_last_event_at) : null;
    const isStaleEvent = Boolean(lastEventAt && eventAt.getTime() < lastEventAt.getTime());

    if (!isStaleEvent && REVENUECAT_ACTIVE_EVENTS.has(eventType)) {
      const isTrial = String(event.period_type || "").toUpperCase() === "TRIAL";
      tenant.subscription_status = isTrial ? TenantSubscriptionStatus.TRIAL : TenantSubscriptionStatus.ACTIVE;
      tenant.is_public = true;
      tenant.subscription_started_at = purchasedAt || tenant.subscription_started_at || eventAt;
      tenant.subscription_current_period_ends_at = expirationAt || keepFutureDate(tenant.subscription_current_period_ends_at);
      tenant.subscription_last_event_at = eventAt;
      tenant.revenuecat_original_app_user_id = event.original_app_user_id || tenant.revenuecat_original_app_user_id || null;
      tenant.revenuecat_product_id = event.product_id || tenant.revenuecat_product_id || null;
      tenant.revenuecat_entitlement_id = primaryEntitlement;
      tenant.revenuecat_store = event.store || tenant.revenuecat_store || null;
      tenant.revenuecat_last_event_type = eventType;
      if (isTrial) {
        tenant.trial_starts_at = purchasedAt || tenant.trial_starts_at || eventAt;
        tenant.trial_ends_at = expirationAt || keepFutureDate(tenant.trial_ends_at);
      }
      await repo.save(tenant);
    }

    if (!isStaleEvent && REVENUECAT_EXPIRATION_EVENTS.has(eventType)) {
      tenant.subscription_current_period_ends_at = expirationAt || tenant.subscription_current_period_ends_at || eventAt;
      tenant.subscription_last_event_at = eventAt;
      tenant.revenuecat_original_app_user_id = event.original_app_user_id || tenant.revenuecat_original_app_user_id || null;
      tenant.revenuecat_product_id = event.product_id || tenant.revenuecat_product_id || null;
      tenant.revenuecat_entitlement_id = primaryEntitlement;
      tenant.revenuecat_store = event.store || tenant.revenuecat_store || null;
      tenant.revenuecat_last_event_type = eventType;
      if (!activeUntil || activeUntil.getTime() <= Date.now()) {
        tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
        tenant.is_public = false;
      }
      await repo.save(tenant);
    }

    if (!isStaleEvent && REVENUECAT_NON_REVOKING_EVENTS.has(eventType)) {
      tenant.subscription_current_period_ends_at =
        expirationAt || keepFutureDate(tenant.subscription_current_period_ends_at);
      tenant.subscription_last_event_at = eventAt;
      tenant.revenuecat_original_app_user_id = event.original_app_user_id || tenant.revenuecat_original_app_user_id || null;
      tenant.revenuecat_product_id = event.product_id || tenant.revenuecat_product_id || null;
      tenant.revenuecat_entitlement_id = primaryEntitlement;
      tenant.revenuecat_store = event.store || tenant.revenuecat_store || null;
      tenant.revenuecat_last_event_type = eventType;
      if (
        tenant.subscription_current_period_ends_at &&
        new Date(tenant.subscription_current_period_ends_at).getTime() <= Date.now()
      ) {
        tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
        tenant.is_public = false;
      }
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
        event_timestamp_ms: event.event_timestamp_ms || null,
        purchased_at_ms: event.purchased_at_ms || null,
        expiration_at_ms: event.expiration_at_ms || null,
        transaction_id: event.transaction_id || null,
        original_transaction_id: event.original_transaction_id || null,
        revenuecat_event_type: eventType,
        store: event.store || null,
        stale_event: isStaleEvent,
        subscription_current_period_ends_at: tenant.subscription_current_period_ends_at || null,
        subscription_last_event_at: tenant.subscription_last_event_at || null,
        subscription_status: tenant.subscription_status,
      },
    });

    return res.json({ ok: true });
  }
}
