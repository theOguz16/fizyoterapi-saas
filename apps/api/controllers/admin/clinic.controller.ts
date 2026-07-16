// Bu controller admin tarafindaki clinic.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import type {
  AdminClinicSubscription,
  SubscriptionRecommendedAction,
  SubscriptionSyncState,
} from "@fitnes-saas/contracts";
import { AppDataSource } from "../../data-source";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { CLINIC_TRIAL_DAYS } from "../../config/subscription";

const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com/v1";

function plusDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
}

function parseRevenueCatDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function pickLatestDate(...dates: Array<Date | null | undefined>) {
  const valid = dates.filter((date): date is Date => Boolean(date && Number.isFinite(date.getTime())));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function toTransportDate(value?: Date | string | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export class AdminClinicController {
  private static resolvePublicWebBaseUrl() {
    return (
      process.env.PUBLIC_WEB_BASE_URL?.trim() ||
      process.env.WEB_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() ||
      (process.env.NODE_ENV === "production" ? "https://fizyoflow.com" : "http://localhost:3939")
    ).replace(/\/+$/, "");
  }

  private static buildTenantQr(slug: string) {
    const short = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `FYF-${slug.toUpperCase()}-${short}`;
  }

  private static buildTenantJoinUrl(slug: string, qrCode: string) {
    const baseUrl = AdminClinicController.resolvePublicWebBaseUrl();
    return `${baseUrl}/join/${encodeURIComponent(slug)}?code=${encodeURIComponent(qrCode)}`;
  }

  private static resolveDetourLinkBaseUrl() {
    const rawBaseUrl = (
      process.env.DETOUR_LINK_BASE_URL?.trim() ||
      process.env.EXPO_PUBLIC_DETOUR_LINK_BASE_URL?.trim() ||
      ""
    ).replace(/\/+$/, "");

    if (/clinerva/i.test(rawBaseUrl)) {
      return "";
    }

    return rawBaseUrl;
  }

  private static buildTenantDetourUrl(slug: string, qrCode: string) {
    const baseUrl = AdminClinicController.resolveDetourLinkBaseUrl();
    if (!baseUrl) return null;

    const mobileScreenPath = `/(intake-member)/salons/${slug}`;
    const webJoinPath = `/join/${slug}`;
    const joinUrl = AdminClinicController.buildTenantJoinUrl(slug, qrCode);

    const params = new URLSearchParams({
      salon_slug: slug,
      screen_path: mobileScreenPath,
      web_join_path: webJoinPath,
      code: qrCode,
      source: "salon_qr",
      campaign: slug,
      channel: "qr",
      fallback_url: joinUrl,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private static serializeSubscription(
    tenant: Tenant,
    syncState: SubscriptionSyncState = "IDLE"
  ): AdminClinicSubscription {
    const trialEndsAt = tenant.trial_ends_at
      ? new Date(tenant.trial_ends_at)
      : tenant.subscription_status === TenantSubscriptionStatus.TRIAL && tenant.subscription_current_period_ends_at
      ? new Date(tenant.subscription_current_period_ends_at)
      : null;
    const remainingMs = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0;
    const remainingDays = trialEndsAt ? Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;
    const hasTrialHistory = Boolean(tenant.trial_starts_at || tenant.trial_ends_at);

    let recommendedAction: SubscriptionRecommendedAction = "WAIT_SETUP";
    if (tenant.subscription_status === TenantSubscriptionStatus.INACTIVE && !hasTrialHistory) {
      recommendedAction = "START_TRIAL";
    } else if (
      tenant.subscription_status === TenantSubscriptionStatus.TRIAL ||
      tenant.subscription_status === TenantSubscriptionStatus.READ_ONLY
    ) {
      recommendedAction = "PURCHASE_IN_APP";
    } else if (tenant.subscription_status === TenantSubscriptionStatus.ACTIVE) {
      recommendedAction = "MANAGE_PLAN";
    }

    return {
      tenant_id: tenant.id,
      review_status: tenant.review_status,
      subscription_status: tenant.subscription_status,
      is_public: tenant.is_public,
      trial_starts_at: toTransportDate(tenant.trial_starts_at),
      trial_ends_at: toTransportDate(tenant.trial_ends_at),
      subscription_started_at: toTransportDate(tenant.subscription_started_at),
      subscription_current_period_ends_at: toTransportDate(tenant.subscription_current_period_ends_at),
      subscription_last_event_at: toTransportDate(tenant.subscription_last_event_at),
      trial_days_total: CLINIC_TRIAL_DAYS,
      trial_days_remaining: tenant.subscription_status === TenantSubscriptionStatus.TRIAL ? remainingDays : 0,
      has_trial_history: hasTrialHistory,
      can_start_trial: tenant.subscription_status === TenantSubscriptionStatus.INACTIVE && !hasTrialHistory,
      can_purchase_in_app: [TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.READ_ONLY].includes(
        tenant.subscription_status
      ),
      purchase_provider: "REVENUECAT",
      purchase_mode: "IN_APP_PURCHASE",
      recommended_action: recommendedAction,
      sync_state: syncState,
      subscription_history_summary: {
        last_event_type: tenant.revenuecat_last_event_type || null,
        last_event_at: toTransportDate(tenant.subscription_last_event_at),
        product_id: tenant.revenuecat_product_id || null,
        store: tenant.revenuecat_store || null,
      },
      store_products: {
        provider: "REVENUECAT",
      },
    };
  }

  private static async fetchRevenueCatSubscriber(appUserId: string) {
    const apiKey = String(process.env.REVENUECAT_REST_API_KEY || "").trim();
    if (!apiKey) return null;

    const response = await fetch(`${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new AppError("REVENUECAT_SYNC_FAILED", 502, "RevenueCat abonelik bilgisi doğrulanamadı");
    }

    return (await response.json()) as {
      subscriber?: {
        original_app_user_id?: string | null;
        entitlements?: Record<
          string,
          {
            expires_date?: string | null;
            purchase_date?: string | null;
            product_identifier?: string | null;
          }
        >;
        subscriptions?: Record<
          string,
          {
            expires_date?: string | null;
            purchase_date?: string | null;
            store?: string | null;
          }
        >;
      };
    };
  }

  private static applyRevenueCatSubscriberSync(tenant: Tenant, payload: Awaited<ReturnType<typeof AdminClinicController.fetchRevenueCatSubscriber>>) {
    const subscriber = payload?.subscriber;
    const expectedEntitlement = String(process.env.REVENUECAT_ENTITLEMENT_ID || "clinic_pro").trim();
    const entitlement = expectedEntitlement ? subscriber?.entitlements?.[expectedEntitlement] : Object.values(subscriber?.entitlements || {})[0];
    const productId = entitlement?.product_identifier || null;
    const subscription = productId ? subscriber?.subscriptions?.[productId] : null;
    const entitlementExpiresAt = parseRevenueCatDate(entitlement?.expires_date);
    const subscriptionExpiresAt = parseRevenueCatDate(subscription?.expires_date);
    const expiresAt = pickLatestDate(entitlementExpiresAt, subscriptionExpiresAt);
    const purchasedAt = pickLatestDate(
      parseRevenueCatDate(entitlement?.purchase_date),
      parseRevenueCatDate(subscription?.purchase_date)
    );
    const hasActiveEntitlement = Boolean(entitlement && (!expiresAt || expiresAt.getTime() > Date.now()));
    const hasExpiredEntitlement = Boolean(entitlement && expiresAt && expiresAt.getTime() <= Date.now());

    if (hasActiveEntitlement) {
      tenant.subscription_status = TenantSubscriptionStatus.ACTIVE;
      tenant.review_status = TenantReviewStatus.PUBLISHED;
      tenant.is_public = true;
      tenant.reviewed_at = tenant.reviewed_at || new Date();
      tenant.review_note = tenant.review_note || "RevenueCat doğrulaması ile otomatik yayına alındı.";
      tenant.subscription_started_at = purchasedAt || tenant.subscription_started_at || new Date();
      tenant.subscription_current_period_ends_at = expiresAt || null;
      tenant.subscription_last_event_at = new Date();
      tenant.revenuecat_original_app_user_id = subscriber?.original_app_user_id || tenant.revenuecat_original_app_user_id || null;
      tenant.revenuecat_product_id = productId || tenant.revenuecat_product_id || null;
      tenant.revenuecat_entitlement_id = expectedEntitlement || tenant.revenuecat_entitlement_id || null;
      tenant.revenuecat_store = subscription?.store || tenant.revenuecat_store || null;
      tenant.revenuecat_last_event_type = "SYNC";
      return "SYNCED" as const;
    }

    if (
      hasExpiredEntitlement &&
      tenant.review_status === TenantReviewStatus.PUBLISHED &&
      [TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.READ_ONLY].includes(
        tenant.subscription_status
      )
    ) {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      tenant.subscription_current_period_ends_at = expiresAt || tenant.subscription_current_period_ends_at || new Date();
      tenant.subscription_last_event_at = new Date();
      tenant.revenuecat_original_app_user_id = subscriber?.original_app_user_id || tenant.revenuecat_original_app_user_id || null;
      tenant.revenuecat_product_id = productId || tenant.revenuecat_product_id || null;
      tenant.revenuecat_entitlement_id = expectedEntitlement || tenant.revenuecat_entitlement_id || null;
      tenant.revenuecat_store = subscription?.store || tenant.revenuecat_store || null;
      tenant.revenuecat_last_event_type = "SYNC_EXPIRED";
      return "SYNCED" as const;
    }

    return "PENDING_SYNC" as const;
  }

  // --- GET /api/admin/clinic/qr ---
  static async getClinicQr(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const repo = AppDataSource.getRepository(Tenant);
      const tenant = await repo.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }

      if (!tenant.qr_code) {
        tenant.qr_code = AdminClinicController.buildTenantQr(tenant.slug || "CLINIC");
        await repo.save(tenant);
      }

      const joinUrl = AdminClinicController.buildTenantJoinUrl(tenant.slug, tenant.qr_code);
      const detourUrl = AdminClinicController.buildTenantDetourUrl(tenant.slug, tenant.qr_code);

      return res.json({
        data: {
          tenant_id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          qr_code: tenant.qr_code,
          qr_payload: detourUrl || joinUrl,
          join_url: joinUrl,
          detour_url: detourUrl,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic QR get error:", error);
      throw new AppError("ADMIN_CLINIC_QR_GET_ERROR", 500, "Klinik QR bilgisi getirilemedi");
    }
  }

  // --- GET /api/admin/clinic/subscription ---
  static async getSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const repo = AppDataSource.getRepository(Tenant);
      const tenant = await repo.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }

      return res.json({
        data: AdminClinicController.serializeSubscription(tenant),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic subscription get error:", error);
      throw new AppError("ADMIN_CLINIC_SUBSCRIPTION_GET_ERROR", 500, "Abonelik bilgisi getirilemedi");
    }
  }

  // --- GET /api/admin/clinic/subscription/history ---
  static async getSubscriptionHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }

      const events = [
        tenant.trial_starts_at
          ? {
              type: "TRIAL_STARTED",
              occurred_at: tenant.trial_starts_at,
              title: "Deneme başladı",
              description: `${CLINIC_TRIAL_DAYS} günlük ücretsiz deneme aktifleşti.`,
            }
          : null,
        tenant.trial_ends_at
          ? {
              type: "TRIAL_ENDS",
              occurred_at: tenant.trial_ends_at,
              title: "Deneme bitişi",
              description: "Deneme süresinin planlanan bitiş zamanı.",
            }
          : null,
        tenant.subscription_started_at
          ? {
              type: "SUBSCRIPTION_STARTED",
              occurred_at: tenant.subscription_started_at,
              title: "Plan aktifleşti",
              description: tenant.revenuecat_product_id || "Uygulama içi satın alma ile plan aktifleşti.",
            }
          : null,
        tenant.subscription_last_event_at
          ? {
              type: tenant.revenuecat_last_event_type || "REVENUECAT_EVENT",
              occurred_at: tenant.subscription_last_event_at,
              title: "RevenueCat olayı",
              description: [tenant.revenuecat_store, tenant.revenuecat_product_id].filter(Boolean).join(" • ") || "Son abonelik olayı işlendi.",
            }
          : null,
      ]
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      return res.json({ data: events });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic subscription history error:", error);
      throw new AppError("ADMIN_CLINIC_SUBSCRIPTION_HISTORY_ERROR", 500, "Abonelik geçmişi getirilemedi");
    }
  }

  // --- POST /api/admin/clinic/subscription/start-trial ---
  static async startTrial(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const repo = AppDataSource.getRepository(Tenant);
      const tenant = await repo.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }
      if (tenant.subscription_status !== TenantSubscriptionStatus.INACTIVE) {
        throw new AppError("TRIAL_ALREADY_STARTED", 409, "Bu salon icin deneme veya plan sureci zaten baslatilmis");
      }
      if (tenant.trial_starts_at || tenant.trial_ends_at) {
        throw new AppError("TRIAL_ALREADY_USED", 409, "Deneme suresi yalnizca bir kez baslatilabilir");
      }

      tenant.subscription_status = TenantSubscriptionStatus.TRIAL;
      tenant.review_status = TenantReviewStatus.PUBLISHED;
      tenant.is_public = true;
      tenant.reviewed_at = tenant.reviewed_at || new Date();
      tenant.review_note = tenant.review_note || "Mobil deneme baslatildiginda otomatik yayina alindi.";
      tenant.trial_starts_at = new Date();
      tenant.trial_ends_at = plusDays(CLINIC_TRIAL_DAYS);
      await repo.save(tenant);

      await AuditLogService.log({
        tenant_id: tenant.id,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_CLINIC_TRIAL_STARTED",
        action: "START_TRIAL",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "tenant",
        target_id: tenant.id,
        metadata: {
          subscription_status: tenant.subscription_status,
          trial_starts_at: tenant.trial_starts_at.toISOString(),
          trial_ends_at: tenant.trial_ends_at?.toISOString() || null,
          purchase_provider: "REVENUECAT",
        },
      });

      await AuditLogService.logProductEvent({
        event_name: "trial_started",
        ...AuditLogService.productContextFromRequest(req),
        tenant_id: tenant.id,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        method: req.method,
        path: req.originalUrl,
        target_type: "tenant",
        target_id: tenant.id,
        metadata: {
          trial_days: CLINIC_TRIAL_DAYS,
          source: "subscription_screen",
        },
      });

      return res.json({
        data: AdminClinicController.serializeSubscription(tenant),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic start trial error:", error);
      throw new AppError("ADMIN_CLINIC_START_TRIAL_ERROR", 500, "Deneme suresi baslatilamadi");
    }
  }

  // --- POST /api/admin/clinic/subscription/sync ---
  static async syncSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const repo = AppDataSource.getRepository(Tenant);
      const tenant = await repo.findOne({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError("TENANT_NOT_FOUND", 404, "Klinik bulunamadi");
      }

      const revenueCatPayload = await AdminClinicController.fetchRevenueCatSubscriber(tenant.id);
      if (!revenueCatPayload) {
        await AuditLogService.log({
          tenant_id: tenant.id,
          actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
          actor_account_id: req.auth?.accountId || null,
          actor_role: req.auth?.role || null,
          event_type: "ADMIN_CLINIC_SUBSCRIPTION_SYNC_PENDING",
          action: "SYNC_REVENUECAT",
          method: req.method,
          path: req.originalUrl,
          status_code: 202,
          success: true,
          request_id: req.requestId || null,
          ip_address: req.ip || null,
          user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
          target_type: "tenant",
          target_id: tenant.id,
          metadata: { reason: "REVENUECAT_REST_API_KEY_MISSING" },
        });

        return res.status(202).json({
          data: AdminClinicController.serializeSubscription(tenant, "PENDING_SYNC"),
        });
      }

      const syncState = AdminClinicController.applyRevenueCatSubscriberSync(tenant, revenueCatPayload);
      if (syncState === "SYNCED") {
        await repo.save(tenant);
      }

      await AuditLogService.log({
        tenant_id: tenant.id,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_CLINIC_SUBSCRIPTION_SYNCED",
        action: "SYNC_REVENUECAT",
        method: req.method,
        path: req.originalUrl,
        status_code: syncState === "SYNCED" ? 200 : 202,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "tenant",
        target_id: tenant.id,
        metadata: {
          sync_state: syncState,
          subscription_status: tenant.subscription_status,
          revenuecat_product_id: tenant.revenuecat_product_id || null,
          revenuecat_entitlement_id: tenant.revenuecat_entitlement_id || null,
          revenuecat_store: tenant.revenuecat_store || null,
        },
      });

      return res.status(syncState === "SYNCED" ? 200 : 202).json({
        data: AdminClinicController.serializeSubscription(tenant, syncState),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic subscription sync error:", error);
      throw new AppError("ADMIN_CLINIC_SUBSCRIPTION_SYNC_ERROR", 500, "Abonelik durumu senkronize edilemedi");
    }
  }
}
