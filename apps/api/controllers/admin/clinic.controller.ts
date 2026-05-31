// Bu controller admin tarafindaki clinic.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";

const ADMIN_TRIAL_DAYS = 5;

function plusDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
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

  private static serializeSubscription(tenant: Tenant) {
    const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const remainingMs = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0;
    const remainingDays = trialEndsAt ? Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;
    const hasTrialHistory = Boolean(tenant.trial_starts_at || tenant.trial_ends_at);

    let recommendedAction = "WAIT_REVIEW";
    if (tenant.review_status === TenantReviewStatus.PUBLISHED) {
      if (tenant.subscription_status === TenantSubscriptionStatus.INACTIVE && !hasTrialHistory) {
        recommendedAction = "START_TRIAL";
      } else if (tenant.subscription_status === TenantSubscriptionStatus.TRIAL) {
        recommendedAction = "PURCHASE_IN_APP";
      } else if (tenant.subscription_status === TenantSubscriptionStatus.READ_ONLY) {
        recommendedAction = "PURCHASE_IN_APP";
      } else if (tenant.subscription_status === TenantSubscriptionStatus.ACTIVE) {
        recommendedAction = "MANAGE_PLAN";
      }
    }

    return {
      tenant_id: tenant.id,
      review_status: tenant.review_status,
      subscription_status: tenant.subscription_status,
      is_public: tenant.is_public,
      trial_starts_at: tenant.trial_starts_at || null,
      trial_ends_at: tenant.trial_ends_at || null,
      trial_days_total: ADMIN_TRIAL_DAYS,
      trial_days_remaining: tenant.subscription_status === TenantSubscriptionStatus.TRIAL ? remainingDays : 0,
      has_trial_history: hasTrialHistory,
      can_start_trial:
        tenant.review_status === TenantReviewStatus.PUBLISHED &&
        tenant.subscription_status === TenantSubscriptionStatus.INACTIVE &&
        !hasTrialHistory,
      can_purchase_in_app:
        tenant.review_status === TenantReviewStatus.PUBLISHED &&
        [TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.READ_ONLY].includes(tenant.subscription_status),
      purchase_provider: "REVENUECAT",
      purchase_mode: "IN_APP_PURCHASE",
      recommended_action: recommendedAction,
    };
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
      if (tenant.review_status !== TenantReviewStatus.PUBLISHED) {
        throw new AppError("CLINIC_REVIEW_NOT_COMPLETED", 409, "Deneme suresi yalnizca onaylanan salonlar icin baslatilabilir");
      }
      if (tenant.subscription_status !== TenantSubscriptionStatus.INACTIVE) {
        throw new AppError("TRIAL_ALREADY_STARTED", 409, "Bu salon icin deneme veya plan sureci zaten baslatilmis");
      }
      if (tenant.trial_starts_at || tenant.trial_ends_at) {
        throw new AppError("TRIAL_ALREADY_USED", 409, "Deneme suresi yalnizca bir kez baslatilabilir");
      }

      tenant.subscription_status = TenantSubscriptionStatus.TRIAL;
      tenant.is_public = true;
      tenant.trial_starts_at = new Date();
      tenant.trial_ends_at = plusDays(ADMIN_TRIAL_DAYS);
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

      return res.json({
        data: AdminClinicController.serializeSubscription(tenant),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin clinic start trial error:", error);
      throw new AppError("ADMIN_CLINIC_START_TRIAL_ERROR", 500, "Deneme suresi baslatilamadi");
    }
  }
}
