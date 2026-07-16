// Bu controller admin tarafindaki settings.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import type { WorkingHours } from "@fitnes-saas/contracts";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { NotificationTemplate, NotificationType } from "../../entities/notification-template.entity";
import {
  NotificationDelivery,
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
} from "../../entities/notification-delivery.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { ManagedGrowthStatus, SalonProfile } from "../../entities/salon-profile.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { Lead } from "../../entities/lead.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { normalizeLessonCatalogServices } from "../../services/package.service";
import { RiskService } from "../../services/risk.service";
import { isReservedPublicSlug } from "../../constants/reserved-slugs";

export class AdminSettingsController {
  private static async logSettingsAudit(
    req: AuthenticatedRequest,
    eventType: string,
    metadata?: Record<string, unknown>
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: eventType,
      action: eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "settings",
      target_id: req.tenantId || req.auth?.tenantId || "settings",
      metadata: metadata ?? null,
    });
  }

  private static normalizeCampaignAudit(value: unknown) {
    if (!Array.isArray(value)) return [] as Array<{
      id: string;
      action: string;
      summary: string;
      actor_id?: string | null;
      created_at: string;
    }>;

    return value
      .map((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const createdAtRaw = String(row.created_at ?? "").trim();
        const createdAt = createdAtRaw && !Number.isNaN(new Date(createdAtRaw).getTime())
          ? new Date(createdAtRaw).toISOString()
          : new Date().toISOString();
        return {
          id: String(row.id ?? "").trim() || `audit-${index + 1}`,
          action: String(row.action ?? "CAMPAIGN_RULES_UPDATED"),
          summary: String(row.summary ?? "Kampanya kuralları güncellendi"),
          actor_id: row.actor_id ? String(row.actor_id) : null,
          created_at: createdAt,
        };
      })
      .slice(-120);
  }

  private static normalizeCampaigns(value: unknown) {
    const defaults = {
      referral_campaigns: [] as Array<{
        id: string;
        name?: string;
        audience?: string;
        trigger_type?: string;
        required_referrals: number;
        reward_type: string;
        reward_value: number;
        reward_label: string;
        reward_target?: string;
        is_active: boolean;
        created_at?: string;
        updated_at?: string;
      }>,
      loyalty_campaigns: [] as Array<{
        id: string;
        name?: string;
        audience?: string;
        trigger_type?: string;
        min_lessons: number;
        reward_type: string;
        reward_value: number;
        reward_label: string;
        reward_target?: string;
        is_active: boolean;
        created_at?: string;
        updated_at?: string;
      }>,
      cancellation_policy: {
        min_hours_before_start: 3,
        refund_policy: "NO_REFUND",
      },
    };

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return defaults;
    }

    const source = value as Record<string, unknown>;
    const referralCampaigns = Array.isArray(source.referral_campaigns) ? source.referral_campaigns : defaults.referral_campaigns;
    const loyaltyCampaigns = Array.isArray(source.loyalty_campaigns) ? source.loyalty_campaigns : defaults.loyalty_campaigns;
    const cancellationPolicyRaw =
      source.cancellation_policy && typeof source.cancellation_policy === "object" && !Array.isArray(source.cancellation_policy)
        ? (source.cancellation_policy as Record<string, unknown>)
        : defaults.cancellation_policy;

    return {
      referral_campaigns: referralCampaigns
        .map((entry, index) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(row.id ?? "").trim() || `ref-${index + 1}`,
            name: String(row.name ?? "").trim() || undefined,
            audience: String(row.audience ?? "ALL"),
            trigger_type: "REFERRAL",
            required_referrals: Math.max(1, Math.floor(Number(row.required_referrals) || 0)),
            reward_type: String(row.reward_type ?? "FREE_CLASS"),
            reward_value: Math.max(0, Number(row.reward_value) || 0),
            reward_label: String(row.reward_label ?? "").trim() || "Ödül",
            reward_target: String(row.reward_target ?? "REFERRER"),
            is_active: row.is_active === true,
            created_at:
              typeof row.created_at === "string" && !Number.isNaN(new Date(row.created_at).getTime())
                ? new Date(row.created_at).toISOString()
                : undefined,
            updated_at:
              typeof row.updated_at === "string" && !Number.isNaN(new Date(row.updated_at).getTime())
                ? new Date(row.updated_at).toISOString()
                : undefined,
          };
        })
        .filter((row) => row.required_referrals > 0),
      loyalty_campaigns: loyaltyCampaigns
        .map((entry, index) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(row.id ?? "").trim() || `loy-${index + 1}`,
            name: String(row.name ?? "").trim() || undefined,
            audience: String(row.audience ?? "ALL"),
            trigger_type: "ATTENDANCE",
            min_lessons: Math.max(1, Math.floor(Number(row.min_lessons) || 0)),
            reward_type: String(row.reward_type ?? "FREE_CLASS"),
            reward_value: Math.max(0, Number(row.reward_value) || 0),
            reward_label: String(row.reward_label ?? "").trim() || "Ödül",
            reward_target: String(row.reward_target ?? "MEMBER"),
            is_active: row.is_active === true,
            created_at:
              typeof row.created_at === "string" && !Number.isNaN(new Date(row.created_at).getTime())
                ? new Date(row.created_at).toISOString()
                : undefined,
            updated_at:
              typeof row.updated_at === "string" && !Number.isNaN(new Date(row.updated_at).getTime())
                ? new Date(row.updated_at).toISOString()
                : undefined,
          };
        })
        .filter((row) => row.min_lessons > 0),
      cancellation_policy: {
        min_hours_before_start: Math.max(1, Math.floor(Number(cancellationPolicyRaw.min_hours_before_start) || 3)),
        refund_policy: String(cancellationPolicyRaw.refund_policy ?? "NO_REFUND"),
      },
    };
  }

  private static normalizeLocation(value: unknown): SalonProfile["location"] {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return {
      city: typeof source.city === "string" ? source.city : undefined,
      district: typeof source.district === "string" ? source.district : undefined,
      phone: typeof source.phone === "string" ? source.phone : undefined,
      address: typeof source.address === "string" ? source.address : undefined,
      maps_embed_url: typeof source.maps_embed_url === "string" ? source.maps_embed_url : undefined,
      campaigns: AdminSettingsController.normalizeCampaigns(source.campaigns),
      campaign_audit: AdminSettingsController.normalizeCampaignAudit(source.campaign_audit),
    } as SalonProfile["location"];
  }

  private static normalizeNullableText(value: unknown, maxLength: number) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    const text = String(value).trim();
    if (!text) return null;
    return text.slice(0, maxLength);
  }

  private static normalizeServiceArea(value: unknown) {
    if (!Array.isArray(value)) return [] as string[];
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .map((item) => item.slice(0, 80))
      )
    ).slice(0, 12);
  }

  private static normalizeManagedGrowthStatus(value: unknown) {
    const status = String(value ?? "").trim().toUpperCase();
    if (Object.values(ManagedGrowthStatus).includes(status as ManagedGrowthStatus)) {
      return status as ManagedGrowthStatus;
    }
    return ManagedGrowthStatus.PREPARING;
  }

  private static normalizeBusinessHours(value: unknown): SalonProfile["business_hours"] {
  const defaults: SalonProfile["business_hours"] = {
    timezone: "Europe/Istanbul",
    working_days: [1, 2, 3, 4, 5, 6, 7],
    start_time: "09:00",
    end_time: "18:00",
    slot_minutes: 60,
    break_duration_minutes: 0,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const raw = value as Record<string, unknown>;

  const parseRequiredTime = (input: unknown, fallback: string) => {
    if (typeof input !== "string") return fallback;
    const trimmed = input.trim();
    return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
  };

  const parseOptionalTime = (input: unknown): string | undefined => {
    if (input === null || input === undefined || input === "") return undefined;
    if (typeof input !== "string") return undefined;
    const trimmed = input.trim();
    return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : undefined;
  };

  const fallbackWorkingDays = defaults.working_days || [1, 2, 3, 4, 5];
  const workingDaysRaw = Array.isArray(raw.working_days) ? raw.working_days : fallbackWorkingDays;

  const workingDays = Array.from(
    new Set(
      workingDaysRaw
        .map((item) => Number(item))
        .map((item) => {
          if (!Number.isInteger(item)) return null;
          if (item === 0) return 7;
          if (item >= 1 && item <= 7) return item;
          return null;
        })
        .filter((item): item is number => item !== null)
    )
  ).sort((a, b) => a - b);

  const slotMinutesRaw = Number(raw.slot_minutes);
  const slotMinutes = Number.isFinite(slotMinutesRaw)
    ? Math.min(Math.max(Math.floor(slotMinutesRaw), 15), 180)
    : 60;

  const breakDurationRaw = Number(raw.break_duration_minutes);
  const breakDurationMinutes = Number.isFinite(breakDurationRaw)
    ? Math.min(Math.max(Math.floor(breakDurationRaw), 0), 60)
    : Number(defaults.break_duration_minutes || 0);

  const normalized: SalonProfile["business_hours"] & WorkingHours = {
    timezone: typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone : defaults.timezone,
    working_days: workingDays.length > 0 ? workingDays : defaults.working_days,
    start_time: parseRequiredTime(raw.start_time, defaults.start_time || "09:00"),
    end_time: parseRequiredTime(raw.end_time, defaults.end_time || "18:00"),
    slot_minutes: slotMinutes,
    break_duration_minutes: breakDurationMinutes,
  };

  const lunchBreakStart = parseOptionalTime(raw.lunch_break_start);
  const lunchBreakEnd = parseOptionalTime(raw.lunch_break_end);

  if (lunchBreakStart && lunchBreakEnd) {
    normalized.lunch_break_start = lunchBreakStart;
    normalized.lunch_break_end = lunchBreakEnd;
  }

  return normalized;
}

  private static validateTemplateType(type: unknown): asserts type is NotificationType {
    if (typeof type !== "string" || !Object.values(NotificationType).includes(type as NotificationType)) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz notification type");
    }
  }

  private static validateServiceCatalog(raw: unknown) {
    if (!Array.isArray(raw)) {
      throw new AppError("VALIDATION_ERROR", 400, "Ders kataloğu dizi formatında olmalıdır");
    }

    raw.forEach((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const capacityLabel = String(row.capacity_label ?? "").trim();
      const startingPrice = Number(row.starting_price);
      const commissionRate = Number(row.trainer_commission_rate);
      const packageType = String(row.package_type ?? "").toUpperCase();
      const lessonMode = String(row.lesson_mode ?? "").toUpperCase();
      const categoryGroup = String(row.category_group ?? "").trim();
      const sessionDurationMinutes = row.session_duration_minutes === undefined ? undefined : Number(row.session_duration_minutes);
      const breakDurationMinutes = row.break_duration_minutes === undefined ? undefined : Number(row.break_duration_minutes);

      if (!title) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: başlık zorunludur`);
      }
      if (!capacityLabel) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: kapasite etiketi zorunludur`);
      }
      if (!Number.isFinite(startingPrice) || startingPrice < 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          400,
          `Ders kataloğu #${index + 1}: başlangıç ücreti 0 veya daha büyük bir sayı olmalıdır`
        );
      }
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        throw new AppError(
          "VALIDATION_ERROR",
          400,
          `Ders kataloğu #${index + 1}: eğitmen prim oranı %0 ile %100 arasında olmalıdır`
        );
      }
      if (packageType && !["GROUP", "PT", "SCOLIOSIS", "REFORMER", "MANUAL", "OTHER"].includes(packageType)) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: paket tipi geçersiz`);
      }
      if (lessonMode && !["PRIVATE", "DUO", "GROUP", "SINGLE"].includes(lessonMode)) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: ders akışı geçersiz`);
      }

      if (row.category_group !== undefined && !categoryGroup) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: kategori grubu boş olamaz`);
      }

      if (row.sub_lessons !== undefined && !Array.isArray(row.sub_lessons)) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: alt dersler dizi formatında olmalıdır`);
      }

      if (
        sessionDurationMinutes !== undefined &&
        (!Number.isFinite(sessionDurationMinutes) || sessionDurationMinutes < 30 || sessionDurationMinutes > 180)
      ) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: ders süresi 30-180 dakika arasında olmalıdır`);
      }

      if (
        breakDurationMinutes !== undefined &&
        (!Number.isFinite(breakDurationMinutes) || breakDurationMinutes < 0 || breakDurationMinutes > 60)
      ) {
        throw new AppError("VALIDATION_ERROR", 400, `Ders kataloğu #${index + 1}: ara süresi 0-60 dakika arasında olmalıdır`);
      }
    });
  }

  private static async ensureProfile(tenantId: string) {
    const profileRepo = AppDataSource.getRepository(SalonProfile);
    let profile = await profileRepo.findOne({
      where: { tenant_id: tenantId, is_published: true },
      order: { updated_at: "DESC", created_at: "DESC" },
    });
    if (profile) return profile;

    profile = await profileRepo.findOne({
      where: { tenant_id: tenantId },
      order: { updated_at: "DESC", created_at: "DESC" },
    });
    if (profile) return profile;

    const tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
    });

    profile = profileRepo.create({
      tenant_id: tenantId,
      slug: tenant?.slug || `tenant-${tenantId.slice(0, 8)}`,
      hero_title: "",
      hero_subtitle: "",
      hero_image_url: "",
      about_text: "",
      why_us: [],
      services: [],
      location: {},
      social_links: {},
      theme: "minimal",
      primary_color: "#111827",
      seo_title: tenant?.name ? `${tenant.name} | Dijital Klinik Vitrini` : null,
      seo_description: tenant?.name ? `${tenant.name} için Fizyoflow destekli dijital klinik vitrini.` : null,
      google_business_url: null,
      google_maps_url: null,
      business_category: "Fizyoterapi Kliniği",
      service_area: [],
      digital_brief: {},
      managed_growth_status: ManagedGrowthStatus.PREPARING,
      business_hours: AdminSettingsController.normalizeBusinessHours(undefined),
      is_published: false,
    });
    await profileRepo.save(profile);
    return profile;
  }

  private static async ensureTemplates(tenantId: string) {
    const repo = AppDataSource.getRepository(NotificationTemplate);
    let templates = await repo.find({
      where: { tenant_id: tenantId },
      order: { created_at: "ASC" },
    });
    if (templates.length > 0) return templates;

    const defaults: Array<{ type: NotificationType; title: string; body: string }> = [
      {
        type: NotificationType.PACKAGE_ENDING,
        title: "Paketiniz bitmek uzere",
        body: "Paket hakkiniz azaldi, yenileme icin salonla iletisime gecin.",
      },
      {
        type: NotificationType.MEASUREMENT_DUE,
        title: "Olcum zamani geldi",
        body: "Yeni olcum randevusu olusturup gelisiminizi takip edebilirsiniz.",
      },
      {
        type: NotificationType.SESSION_REMINDER,
        title: "Seans hatirlatmasi",
        body: "Planli seansinizdan once check-in yapmayi unutmayin.",
      },
    ];

    templates = await repo.save(
      defaults.map((item) =>
        repo.create({
          tenant_id: tenantId,
          type: item.type,
          title: item.title,
          body: item.body,
          settings: {
            mode: "INSTANT",
            cadence: "DAILY",
            next_run_at: null,
          },
          is_active: true,
        })
      )
    );

    return templates;
  }

  private static async getGrowthAnalytics(tenantId: string) {
    const auditRepo = AppDataSource.getRepository(AuditLog);
    const leadRepo = AppDataSource.getRepository(Lead);
    const ctaEvents = [
      "PUBLIC_SITE_WHATSAPP_CLICK",
      "PUBLIC_SITE_PHONE_CLICK",
      "PUBLIC_SITE_MAP_CLICK",
      "PUBLIC_SITE_INSTAGRAM_CLICK",
      "PUBLIC_SITE_REVIEW_CLICK",
    ];
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [page_views, cta_clicks, lead_count, byEventRows, last30Rows] = await Promise.all([
      auditRepo.count({ where: { tenant_id: tenantId, event_type: "PUBLIC_SITE_PAGE_VIEW" } }),
      auditRepo.count({
        where: {
          tenant_id: tenantId,
          event_type: In(ctaEvents),
        },
      }),
      leadRepo.count({ where: { tenant_id: tenantId } }),
      auditRepo
        .createQueryBuilder("log")
        .select("log.event_type", "event_type")
        .addSelect("COUNT(*)", "count")
        .where("log.tenant_id = :tenantId", { tenantId })
        .andWhere("log.event_type LIKE :prefix", { prefix: "PUBLIC_SITE_%" })
        .groupBy("log.event_type")
        .getRawMany<{ event_type: string; count: string }>(),
      auditRepo
        .createQueryBuilder("log")
        .select("log.event_type", "event_type")
        .addSelect("COUNT(*)", "count")
        .where("log.tenant_id = :tenantId", { tenantId })
        .andWhere("log.event_type LIKE :prefix", { prefix: "PUBLIC_SITE_%" })
        .andWhere("log.created_at >= :since", { since: since30Days })
        .groupBy("log.event_type")
        .getRawMany<{ event_type: string; count: string }>(),
    ]);

    const by_event = Object.fromEntries(byEventRows.map((row) => [row.event_type, Number(row.count) || 0]));
    const last_30_days = Object.fromEntries(last30Rows.map((row) => [row.event_type, Number(row.count) || 0]));
    const conversion_rate = page_views > 0 ? Number(((lead_count / page_views) * 100).toFixed(1)) : 0;

    return {
      page_views,
      cta_clicks,
      lead_count,
      conversion_rate,
      by_event,
      last_30_days,
    };
  }

  // --- GET /api/admin/settings ---
  static async get(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const [profile, templates, growthAnalytics] = await Promise.all([
        AdminSettingsController.ensureProfile(tenantId),
        AdminSettingsController.ensureTemplates(tenantId),
        AdminSettingsController.getGrowthAnalytics(tenantId),
      ]);

      profile.services = normalizeLessonCatalogServices(profile.services);

      return res.json({
        data: {
          profile: {
            ...profile,
            location: AdminSettingsController.normalizeLocation(profile.location),
          },
          notification_templates: templates,
          growth_analytics: growthAnalytics,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin settings get error:", error);
      throw new AppError("ADMIN_SETTINGS_GET_ERROR", 500, "Ayarlar getirilemedi");
    }
  }

  // --- PUT /api/admin/settings ---
  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const profileRepo = AppDataSource.getRepository(SalonProfile);
      const templateRepo = AppDataSource.getRepository(NotificationTemplate);
      const actorId = req.auth?.sub || null;

      const profile = await AdminSettingsController.ensureProfile(tenantId);
      const previousBusinessHours = JSON.stringify(AdminSettingsController.normalizeBusinessHours(profile.business_hours));
      let businessHoursChanged = false;
      const normalizedCurrentLocation = AdminSettingsController.normalizeLocation(profile.location);
      const previousCampaigns = JSON.stringify(normalizedCurrentLocation.campaigns || {});
      const previousAudit = Array.isArray((normalizedCurrentLocation as any).campaign_audit)
        ? ((normalizedCurrentLocation as any).campaign_audit as Array<Record<string, unknown>>)
        : [];
      const profileInput = req.body?.profile as Partial<SalonProfile> | undefined;

      if (profileInput && typeof profileInput === "object") {
        if (profileInput.slug !== undefined) {
          const nextSlug = String(profileInput.slug).trim().toLowerCase();
          if (isReservedPublicSlug(nextSlug)) {
            throw new AppError("RESERVED_SLUG", 422, "Bu klinik URL kodu sistem tarafından ayrılmıştır");
          }
          const [profileConflict, tenantConflict] = await Promise.all([
            profileRepo.findOne({ where: { slug: nextSlug } }),
            AppDataSource.getRepository(Tenant).findOne({ where: { slug: nextSlug } }),
          ]);
          if (
            (profileConflict && profileConflict.id !== profile.id) ||
            (tenantConflict && tenantConflict.id !== tenantId)
          ) {
            throw new AppError("SLUG_CONFLICT", 409, "Bu klinik URL kodu başka bir profil tarafından kullanılıyor");
          }
          profile.slug = nextSlug;
        }
        if (profileInput.hero_title !== undefined) profile.hero_title = String(profileInput.hero_title);
        if (profileInput.hero_subtitle !== undefined) profile.hero_subtitle = String(profileInput.hero_subtitle);
        if (profileInput.hero_image_url !== undefined) profile.hero_image_url = String(profileInput.hero_image_url);
        if (profileInput.about_text !== undefined) profile.about_text = String(profileInput.about_text);
        if (profileInput.theme !== undefined) profile.theme = String(profileInput.theme);
        if (profileInput.primary_color !== undefined) profile.primary_color = String(profileInput.primary_color);
        if (profileInput.seo_title !== undefined) profile.seo_title = AdminSettingsController.normalizeNullableText(profileInput.seo_title, 160);
        if (profileInput.seo_description !== undefined) {
          profile.seo_description = AdminSettingsController.normalizeNullableText(profileInput.seo_description, 240);
        }
        if (profileInput.google_business_url !== undefined) {
          profile.google_business_url = AdminSettingsController.normalizeNullableText(profileInput.google_business_url, 260);
        }
        if (profileInput.google_maps_url !== undefined) {
          profile.google_maps_url = AdminSettingsController.normalizeNullableText(profileInput.google_maps_url, 260);
        }
        if (profileInput.business_category !== undefined) {
          profile.business_category = AdminSettingsController.normalizeNullableText(profileInput.business_category, 100);
        }
        if (profileInput.service_area !== undefined) profile.service_area = AdminSettingsController.normalizeServiceArea(profileInput.service_area);
        if (profileInput.digital_brief !== undefined) {
          profile.digital_brief =
            profileInput.digital_brief && typeof profileInput.digital_brief === "object" && !Array.isArray(profileInput.digital_brief)
              ? (profileInput.digital_brief as SalonProfile["digital_brief"])
              : {};
        }
        if (profileInput.managed_growth_status !== undefined) {
          profile.managed_growth_status = AdminSettingsController.normalizeManagedGrowthStatus(profileInput.managed_growth_status);
        }
        if (profileInput.business_hours !== undefined) {
          const normalizedBusinessHours = AdminSettingsController.normalizeBusinessHours(profileInput.business_hours);

          profile.business_hours = normalizedBusinessHours;
          businessHoursChanged = JSON.stringify(normalizedBusinessHours) !== previousBusinessHours;
        }
        if (profileInput.is_published !== undefined) profile.is_published = Boolean(profileInput.is_published);
        if (profileInput.location !== undefined && typeof profileInput.location === "object" && !Array.isArray(profileInput.location)) {
          profile.location = AdminSettingsController.normalizeLocation(profileInput.location);
          const nextLocation = profile.location as Record<string, unknown>;
          const nextCampaigns = JSON.stringify((nextLocation.campaigns as Record<string, unknown>) || {});
          if (previousCampaigns !== nextCampaigns) {
            const campaigns =
              nextLocation.campaigns && typeof nextLocation.campaigns === "object" && !Array.isArray(nextLocation.campaigns)
                ? (nextLocation.campaigns as Record<string, unknown>)
                : {};
            const referralCount = Array.isArray(campaigns.referral_campaigns) ? campaigns.referral_campaigns.length : 0;
            const loyaltyCount = Array.isArray(campaigns.loyalty_campaigns) ? campaigns.loyalty_campaigns.length : 0;
            const updatedAudit = [
              ...previousAudit,
              {
                id: `audit-${Date.now()}`,
                action: "CAMPAIGN_RULES_UPDATED",
                summary: `Referans: ${referralCount} kural • Sadakat: ${loyaltyCount} kural`,
                actor_id: actorId,
                created_at: new Date().toISOString(),
              },
            ].slice(-120);
            (nextLocation as any).campaign_audit = AdminSettingsController.normalizeCampaignAudit(updatedAudit);
            profile.location = nextLocation as SalonProfile["location"];
          }
        }
        if (
          profileInput.social_links !== undefined &&
          typeof profileInput.social_links === "object" &&
          !Array.isArray(profileInput.social_links)
        ) {
          profile.social_links = profileInput.social_links as SalonProfile["social_links"];
        }
        if (Array.isArray(profileInput.why_us)) profile.why_us = profileInput.why_us as SalonProfile["why_us"];
        if (Array.isArray(profileInput.services)) {
          AdminSettingsController.validateServiceCatalog(profileInput.services);
          const normalizedServices = normalizeLessonCatalogServices(profileInput.services);
          if (normalizedServices.length === 0) {
            throw new AppError("VALIDATION_ERROR", 400, "En az bir ders kataloğu öğesi tanımlanmalıdır");
          }
          if (!normalizedServices.some((item) => item.active)) {
            throw new AppError("VALIDATION_ERROR", 400, "En az bir ders kataloğu öğesi aktif olmalıdır");
          }
          profile.services = normalizedServices as unknown as SalonProfile["services"];
        }
      }

      profile.location = AdminSettingsController.normalizeLocation(profile.location);
      await profileRepo.save(profile);

      if (businessHoursChanged) {
        await AuditLogService.logProductEvent({
          event_name: "working_hours_saved",
          ...AuditLogService.productContextFromRequest(req),
          tenant_id: tenantId,
          actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
          actor_account_id: req.auth?.accountId || null,
          actor_role: req.auth?.role || null,
          method: req.method,
          path: req.originalUrl,
          target_type: "settings",
          target_id: tenantId,
          metadata: {
            working_days_count: Array.isArray(profile.business_hours?.working_days) ? profile.business_hours.working_days.length : 0,
            timezone: profile.business_hours?.timezone || null,
          },
        });
      }

      const templatesInput = req.body?.notification_templates as
        | Array<{
            type: NotificationType;
            title?: string;
            body?: string;
            settings?: NotificationTemplate["settings"];
            is_active?: boolean;
          }>
        | undefined;

      if (Array.isArray(templatesInput)) {
        for (const item of templatesInput) {
          AdminSettingsController.validateTemplateType(item?.type);
          let row = await templateRepo.findOne({
            where: { tenant_id: tenantId, type: item.type },
          });
          if (!row) {
            row = templateRepo.create({
              tenant_id: tenantId,
              type: item.type,
              title: item.title ? String(item.title) : item.type,
              body: item.body ? String(item.body) : "",
              settings:
                item?.settings && typeof item.settings === "object" && !Array.isArray(item.settings)
                  ? (item.settings as NotificationTemplate["settings"])
                  : {
                      mode: "INSTANT",
                      cadence: "DAILY",
                      next_run_at: null,
                    },
              is_active: item.is_active !== undefined ? Boolean(item.is_active) : true,
            });
          } else {
            if (item.title !== undefined) row.title = String(item.title);
            if (item.body !== undefined) row.body = String(item.body);
            if (item.settings !== undefined && typeof item.settings === "object" && !Array.isArray(item.settings)) {
              row.settings = item.settings as NotificationTemplate["settings"];
            }
            if (item.is_active !== undefined) row.is_active = Boolean(item.is_active);
          }
          await templateRepo.save(row);
        }
      }

      const templates = await templateRepo.find({
        where: { tenant_id: tenantId },
        order: { created_at: "ASC" },
      });
      const growthAnalytics = await AdminSettingsController.getGrowthAnalytics(tenantId);

      return res.json({
        data: {
          profile: {
            ...profile,
            location: AdminSettingsController.normalizeLocation(profile.location),
          },
          notification_templates: templates,
          growth_analytics: growthAnalytics,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin settings update error:", error);
      throw new AppError("ADMIN_SETTINGS_UPDATE_ERROR", 500, "Ayarlar guncellenemedi");
    }
  }

  // --- POST /api/admin/settings/notifications/trigger ---
  static async triggerTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const adminId = req.auth?.sub;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const rawType = String(req.body?.type ?? "").toUpperCase();
      if (!Object.values(NotificationType).includes(rawType as NotificationType)) {
        throw new AppError("VALIDATION_ERROR", 400, "Gecersiz notification type");
      }

      const template = await AppDataSource.getRepository(NotificationTemplate).findOne({
        where: { tenant_id: tenantId, type: rawType as NotificationType },
      });
      if (!template) {
        throw new AppError("NOTIFICATION_TEMPLATE_NOT_FOUND", 404, "Bildirim sablonu bulunamadi");
      }

      const audience = String(req.body?.audience ?? "ALL_MEMBERS").trim().toUpperCase();
      const userRepo = AppDataSource.getRepository(User);
      let members: User[] = [];

      if (audience === "TRAINERS") {
        members = await userRepo.find({
          where: { tenant_id: tenantId, role: UserRole.TRAINER, is_active: true },
          select: ["id", "first_name", "last_name", "email"],
          order: { created_at: "DESC" },
          take: 500,
        });
      } else if (audience === "AT_RISK") {
        const riskResult = await RiskService.listRiskMembers({
          tenantId,
          riskSegment: "AT_RISK",
          memberActivity: "ACTIVE",
          limit: 500,
        });
        const memberIds = riskResult.data.map((row) => row.member_id);
        members = memberIds.length
          ? await userRepo.find({
              where: memberIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.MEMBER })) as any,
              select: ["id", "first_name", "last_name", "email"],
            })
          : [];
      } else {
        members = await userRepo.find({
          where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true },
          select: ["id", "first_name", "last_name", "email"],
          order: { created_at: "DESC" },
          take: 500,
        });
      }

      const now = new Date();
      const eventRepo = AppDataSource.getRepository(NotificationEvent);
      const deliveryRepo = AppDataSource.getRepository(NotificationDelivery);
      const events = members.map((member) => {
        const memberFullName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.email;
        return eventRepo.create({
          tenant_id: tenantId,
          type: `TEMPLATE_${template.type}`,
          member_id: member.id,
          payload: {
            title: template.title,
            body: template.body,
            template_type: template.type,
            audience,
            member_full_name: memberFullName,
            member_email: member.email,
            settings: template.settings ?? {},
            sent_via: "MOCK_PUSH",
          },
          status: NotificationEventStatus.PROCESSED,
          triggered_by_admin_id: adminId,
          processed_at: now,
        });
      });
      if (events.length > 0) {
        await eventRepo.save(events);
        await deliveryRepo.save(
          events.map((event) =>
            deliveryRepo.create({
              tenant_id: tenantId,
              event_id: event.id,
              member_id: event.member_id,
              channel: NotificationDeliveryChannel.MOCK_PUSH,
              status: NotificationDeliveryStatus.SENT,
              sent_at: now,
            })
          )
        );
      }

      return res.json({
        data: {
          template_type: template.type,
          audience,
          total_targeted: members.length,
          events_created: events.length,
          message: "Bildirim tetikleme islemi baslatildi (mock push)",
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin settings trigger template error:", error);
      throw new AppError("ADMIN_SETTINGS_TEMPLATE_TRIGGER_ERROR", 500, "Bildirim tetiklenemedi");
    }
  }

  static async notificationLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 40;
      const eventRepo = AppDataSource.getRepository(NotificationEvent);
      const rows = await eventRepo.find({
        where: { tenant_id: tenantId } as any,
        order: { created_at: "DESC" },
        take: limit,
      });

      const memberIds = Array.from(new Set(rows.map((row) => String(row.member_id || "")).filter(Boolean)));
      const members = memberIds.length
        ? await AppDataSource.getRepository(User).find({
            where: memberIds.map((id) => ({ tenant_id: tenantId, id })) as any,
            select: ["id", "first_name", "last_name", "email"],
          })
        : [];
      const eventIds = rows.map((row) => row.id);
      const deliveries = eventIds.length
        ? await AppDataSource.getRepository(NotificationDelivery).find({
            where: { tenant_id: tenantId, event_id: In(eventIds) } as any,
            order: { created_at: "DESC" },
          })
        : [];
      const deliveriesByEvent = new Map<string, NotificationDelivery[]>();
      for (const delivery of deliveries) {
        const current = deliveriesByEvent.get(delivery.event_id) || [];
        current.push(delivery);
        deliveriesByEvent.set(delivery.event_id, current);
      }
      const memberMap = new Map(
        members.map((member) => [
          member.id,
          {
            full_name: `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.email,
            email: member.email,
          },
        ])
      );

      return res.json({
        data: rows.map((row) => ({
          id: row.id,
          type: row.type,
          status: row.status,
          created_at: row.created_at,
          processed_at: row.processed_at || null,
          error_message: row.error_message || null,
          member_id: row.member_id,
          member_full_name: memberMap.get(row.member_id)?.full_name || String(row.payload?.member_full_name || "") || null,
          member_email: memberMap.get(row.member_id)?.email || String(row.payload?.member_email || "") || null,
          title: String(row.payload?.title || row.payload?.template_type || row.type || "Bildirim"),
          body: String(row.payload?.body || row.payload?.message || ""),
          delivery_summary: row.payload?.delivery_summary || null,
          deliveries: (deliveriesByEvent.get(row.id) || []).map((delivery) => ({
            id: delivery.id,
            channel: delivery.channel,
            status: delivery.status,
            platform: delivery.platform || null,
            attempt_count: delivery.attempt_count || 0,
            provider_ticket_id: delivery.provider_ticket_id || null,
            error_message: delivery.error_message || null,
            sent_at: delivery.sent_at || null,
            delivered_at: delivery.delivered_at || null,
          })),
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin settings notification logs error:", error);
      throw new AppError("ADMIN_SETTINGS_NOTIFICATION_LOGS_ERROR", 500, "Bildirim kayıtları getirilemedi");
    }
  }
}
