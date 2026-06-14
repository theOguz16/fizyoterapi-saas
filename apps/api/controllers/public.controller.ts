// Bu controller genel tarafindaki public.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { SalonProfile } from "../entities/salon-profile.entity";
import { SalonImage, SalonImageType } from "../entities/salon-image.entity";
import { Lead, LeadStatus } from "../entities/lead.entity";
import { Package, PackageType } from "../entities/package.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { TrainerSkill } from "../entities/trainer-skill.entity";
import { AppError } from "../errors/AppError";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { ClassSession, LessonCategory, SessionStatus, SessionType } from "../entities/class-session.entity";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { AuditLogService } from "../services/audit-log.service";
import { GroupClassService } from "../services/group-class.service";
import { UserPackage } from "../entities/user-package.entity";
import { isReservedPublicSlug } from "../constants/reserved-slugs";
import { DemoLeadEmailService } from "../services/demo-lead-email.service";
export class PublicController {
  private static readonly WEEKDAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  private static readonly BLOCKING_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED];
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private static normalizeCampaigns(raw: unknown) {
    const defaults = {
      referral_campaigns: [
        {
          id: "ref-default-2",
          required_referrals: 2,
          reward_type: "GROUP_CLASS_CREDIT",
          reward_value: 1,
          reward_label: "1 Grup Dersi Hediyesi",
          is_active: true,
        },
      ],
      loyalty_campaigns: [] as Array<{
        id: string;
        min_lessons: number;
        reward_type: string;
        reward_value: number;
        reward_label: string;
        is_active: boolean;
      }>,
      cancellation_policy: {
        min_hours_before_start: 3,
        refund_policy: "NO_REFUND",
      },
    };

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return defaults;
    }

    const source = raw as Record<string, unknown>;
    const referralRaw = Array.isArray(source.referral_campaigns) ? source.referral_campaigns : defaults.referral_campaigns;
    const loyaltyRaw = Array.isArray(source.loyalty_campaigns) ? source.loyalty_campaigns : defaults.loyalty_campaigns;
    const cancellationRaw =
      source.cancellation_policy && typeof source.cancellation_policy === "object" && !Array.isArray(source.cancellation_policy)
        ? (source.cancellation_policy as Record<string, unknown>)
        : defaults.cancellation_policy;

    return {
      referral_campaigns: referralRaw
        .map((row, index) => {
          const item = (row ?? {}) as Record<string, unknown>;
          return {
            id: String(item.id ?? "").trim() || `ref-${index + 1}`,
            required_referrals: Math.max(1, Math.floor(Number(item.required_referrals) || 0)),
            reward_type: String(item.reward_type ?? "GROUP_CLASS_CREDIT"),
            reward_value: Math.max(0, Number(item.reward_value) || 0),
            reward_label: String(item.reward_label ?? "").trim() || "Ödül",
            is_active: item.is_active === undefined ? true : Boolean(item.is_active),
          };
        })
        .filter((row) => row.required_referrals > 0),
      loyalty_campaigns: loyaltyRaw
        .map((row, index) => {
          const item = (row ?? {}) as Record<string, unknown>;
          return {
            id: String(item.id ?? "").trim() || `loy-${index + 1}`,
            min_lessons: Math.max(1, Math.floor(Number(item.min_lessons) || 0)),
            reward_type: String(item.reward_type ?? "GROUP_CLASS_CREDIT"),
            reward_value: Math.max(0, Number(item.reward_value) || 0),
            reward_label: String(item.reward_label ?? "").trim() || "Ödül",
            is_active: item.is_active === undefined ? true : Boolean(item.is_active),
          };
        })
        .filter((row) => row.min_lessons > 0),
      cancellation_policy: {
        min_hours_before_start: Math.max(1, Math.floor(Number(cancellationRaw.min_hours_before_start) || 3)),
        refund_policy: String(cancellationRaw.refund_policy ?? "NO_REFUND"),
      },
    };
  }

  // --- GET /salons/:slug ---
  static async getSalonPublicPage(req: Request, res: Response) {
    try {
      const slug = PublicController.getSlug(req);
      if (!slug) {
        throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");
      }

      const context = await PublicController.resolvePublicSalonContext(slug);
      if (!context.tenant) {
        throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
      }
      const profile = context.profile || PublicController.buildFallbackProfile(context.tenant, slug);
      const galleryImages = await AppDataSource.getRepository(SalonImage).find({
        where: {
          tenant_id: context.tenant.id,
          type: SalonImageType.GALLERY,
        },
        order: { sort_order: "ASC" },
        select: ["id", "url", "type", "sort_order", "meta"],
      });
      const publicPackages = await AppDataSource.getRepository(Package).find({
        where: {
          tenant_id: context.tenant.id,
          is_active: true,
          is_public: true,
          is_visible: true,
        },
        order: { created_at: "DESC" as any },
      });
      const packageMemberCounts = publicPackages.length
        ? await PublicController.getActiveMemberCountsByPackage(publicPackages.map((row) => row.id), context.tenant.id)
        : new Map<string, number>();

      // Public whitelist (sadece public alanlar)
      return res.json({
        id: context.tenant.id,
        name: context.tenant.name,
        slug: profile.slug,
        hero_title: profile.hero_title,
        hero_subtitle: profile.hero_subtitle,
        hero_image_url: profile.hero_image_url,
        seo_title: profile.seo_title || null,
        seo_description: profile.seo_description || null,
        google_business_url: profile.google_business_url || null,
        google_maps_url: profile.google_maps_url || null,
        business_category: profile.business_category || null,
        service_area: Array.isArray(profile.service_area) ? profile.service_area : [],
        managed_growth_status: profile.managed_growth_status || "PREPARING",
        digital_brief: {
          logo_url: profile.digital_brief?.logo_url || "",
          gallery_urls: Array.isArray(profile.digital_brief?.gallery_urls) ? profile.digital_brief.gallery_urls : [],
          working_hours_note: profile.digital_brief?.working_hours_note || "",
          review_url: profile.digital_brief?.review_url || "",
          campaign_note: profile.digital_brief?.campaign_note || "",
          target_audience: profile.digital_brief?.target_audience || "",
          brand_voice: profile.digital_brief?.brand_voice || "",
        },
        about_text: profile.about_text,
        why_us: profile.why_us,
        services: PublicController.buildPublicServiceCatalog(publicPackages, profile.services, packageMemberCounts),
        location: profile.location,
        social_links: profile.social_links,
        theme: profile.theme,
        primary_color: profile.primary_color,
        business_hours: profile.business_hours,
        city:
          profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
            ? String((profile.location as Record<string, unknown>).city ?? "").trim() || null
            : null,
        district:
          profile.location && typeof profile.location === "object" && !Array.isArray(profile.location)
            ? String((profile.location as Record<string, unknown>).district ?? "").trim() || null
            : null,
        campaigns: PublicController.normalizeCampaigns((profile.location as Record<string, unknown> | undefined)?.campaigns),
        gallery_images: galleryImages.map((row) => ({
          id: row.id,
          url: row.url,
          type: row.type,
          sort_order: row.sort_order,
          meta: row.meta || {},
        })),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Salon profili getirilirken hata:", error);
      throw new AppError("SALON_PAGE_ERROR", 500, "Salon sayfası getirilirken hata oluştu");
    }
  }

  // --- GET /salons/:slug/packages ---
  static async getSalonPublicPackages(req: Request, res: Response) {
    try {
      const slug = PublicController.getSlug(req);
      if (!slug) {
        throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");
      }

      const context = await PublicController.resolvePublicSalonContext(slug);
      if (!context.tenant) {
        throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
      }

      // Not: is_visible alanın yoksa kaldır veya entity'ne göre değiştir
      const packages = await AppDataSource.getRepository(Package).find({
        where: {
          tenant_id: context.tenant.id,
          is_active: true,
          is_public: true,
          is_visible: true,
        },
        order: { created_at: "DESC" as any }, // TenantScopedEntity'de created_at varsa
      });

      // Public whitelist (tenant_id vb. internal alanları sızdırma)
      const data = packages.map((p) => {
        const rules = p.rules && typeof p.rules === "object" ? (p.rules as Record<string, unknown>) : {};
        const lessonMode = String(rules.lesson_mode ?? (p.capacity > 2 ? "GROUP" : p.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase();
        const weeklyClassHours = PublicController.deriveWeeklyClassHours(p);
        const dropInGroupPackage = lessonMode === "GROUP";
        return {
        id: p.id,
        title: p.title,
        type: p.type,
        total_credits: p.total_credits,
        duration_days: p.duration_days,
        capacity: p.capacity,
        rules: p.rules,
        display_price: p.display_price,
        summary: typeof p.rules?.summary === "string" ? p.rules.summary : null,
        weekly_class_hours: weeklyClassHours,
        required_preference_slots: dropInGroupPackage ? 1 : weeklyClassHours * 3,
        required_trainer_free_slots: dropInGroupPackage ? 1 : weeklyClassHours * 2,
        lesson_mode: lessonMode,
        sub_lessons: Array.isArray(rules.sub_lessons) ? rules.sub_lessons : [],
        session_duration_minutes: Math.max(30, Number(rules.session_duration_minutes || 45)),
        break_duration_minutes: Math.max(0, Number(rules.break_duration_minutes || 0)),
        allow_member_multi_select: true,
        allow_drop_in_booking:
          typeof rules.allow_drop_in_booking === "boolean"
            ? rules.allow_drop_in_booking
            : dropInGroupPackage,
        };
      });

      return res.json({ data });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Paketler getirilirken hata:", error);
      throw new AppError("PACKAGES_ERROR", 500, "Paketler getirilirken hata oluştu");
    }
  }

  static async getSalonDayOptions(req: Request, res: Response) {
    const slug = PublicController.getSlug(req);
    if (!slug) throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");
    const context = await PublicController.resolvePublicSalonContext(slug);
    if (!context.tenant) throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");

    const profile = context.profile || PublicController.buildFallbackProfile(context.tenant, slug);
    const packageIds = PublicController.parsePackageIds(req.query.package_ids);
    const selectedPackages = packageIds.length
      ? await AppDataSource.getRepository(Package).find({
          where: packageIds.map((id) => ({
            tenant_id: context.tenant!.id,
            id,
            is_active: true,
            is_public: true,
            is_visible: true,
          })) as any,
        })
      : [];
    const businessHours = profile.business_hours as Record<string, unknown> | undefined;
    const groupRows = await PublicController.buildGroupClassDayOptions(context.tenant.id, selectedPackages, businessHours);
    const rows = groupRows.length > 0 ? groupRows : PublicController.buildDayOptions(businessHours);
    return res.json({ data: rows });
  }

  static async getSalonTrainerOptions(req: Request, res: Response) {
    const slug = PublicController.getSlug(req);
    const packageId = String(req.query.package_id ?? "").trim();
    const selectedDayRows = PublicController.parseSelectedDays(req.query.selected_days);
    if (!slug) throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");
    const context = await PublicController.resolvePublicSalonContext(slug);
    if (!context.tenant) throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
    const tenant = context.tenant;

    const trainerRepo = AppDataSource.getRepository(User);
    const skillRepo = AppDataSource.getRepository(TrainerSkill);
    const trainers = await trainerRepo.find({
      where: { tenant_id: tenant.id, role: UserRole.TRAINER, is_active: true },
      order: { first_name: "ASC", last_name: "ASC" },
    });
    const skills = trainers.length
      ? await skillRepo.find({
          where: trainers.map((row) => ({ tenant_id: tenant.id, trainer_id: row.id, is_active: true })) as any,
        })
      : [];
    const packageRow = packageId && PublicController.UUID_PATTERN.test(packageId)
      ? await AppDataSource.getRepository(Package).findOne({
          where: { tenant_id: tenant.id, id: packageId, is_active: true, is_public: true, is_visible: true },
        })
      : null;
    const requiredMatchingSlots = selectedDayRows.length > 0
      ? Math.max(1, Math.ceil(selectedDayRows.length * (2 / 3)))
      : Math.max(1, PublicController.deriveWeeklyClassHours(packageRow) * 2);
    const allowedCategories = PublicController.packageToLessonCategories(packageRow?.type);
    const skillMap = new Map<string, LessonCategory[]>(trainers.map((row) => [row.id, []]));
    for (const skill of skills) {
      const current = skillMap.get(skill.trainer_id) || [];
      current.push(skill.lesson_category);
      skillMap.set(skill.trainer_id, current);
    }

    const matchingSlotsMap = selectedDayRows.length > 0
      ? await PublicController.countTrainerFreeSlotsByTrainer(tenant.id, trainers.map((row) => row.id), selectedDayRows)
      : new Map<string, number>(trainers.map((row) => [row.id, requiredMatchingSlots]));

    const data = trainers
      .filter((trainer) => {
        if (!allowedCategories.length) return true;
        const trainerSkills = skillMap.get(trainer.id) || [];
        return trainerSkills.length === 0 || trainerSkills.some((row) => allowedCategories.includes(row));
      })
      .map((trainer) => ({
        id: trainer.id,
        full_name: `${trainer.first_name} ${trainer.last_name}`.trim(),
        specialties: Array.from(new Set((skillMap.get(trainer.id) || []).map((row) => String(row)))),
        bio: "Seçilen paket ve salon akışı için uygun eğitmen.",
        rating_label: (matchingSlotsMap.get(trainer.id) || 0) >= requiredMatchingSlots ? "Uygun" : "Yetersiz",
        compatibility_note: selectedDayRows.length > 0
          ? `${selectedDayRows.length} tercihten ${matchingSlotsMap.get(trainer.id) || 0} tanesi uygun.`
          : packageRow
            ? `${packageRow.title} için eşleşen eğitmen.`
            : "Salon için uygun eğitmen.",
        avatar_label: `${trainer.first_name[0] || ""}${trainer.last_name[0] || ""}`.toUpperCase(),
        matching_slots: matchingSlotsMap.get(trainer.id) || 0,
        required_matching_slots: requiredMatchingSlots,
        is_available: (matchingSlotsMap.get(trainer.id) || 0) >= requiredMatchingSlots,
        unavailable_reason:
          (matchingSlotsMap.get(trainer.id) || 0) >= requiredMatchingSlots
            ? null
            : `${requiredMatchingSlots} uygun slot gerekiyor.`,
      }));

    data.sort((a, b) => {
      if (Boolean(a.is_available) === Boolean(b.is_available)) {
        return (b.matching_slots || 0) - (a.matching_slots || 0);
      }
      return a.is_available ? -1 : 1;
    });

    return res.json({ data });
  }

  static async createDiscoveryProfile(req: Request, res: Response) {
    const profile = PublicController.normalizeDiscoveryPayload(req.body);
    return res.json({
      data: {
        profile_summary: PublicController.buildDiscoverySummary(profile),
        explanation_points: PublicController.buildDiscoveryExplanation(profile),
        recommended_package_type: PublicController.recommendPackageType(profile),
      },
    });
  }

  static async getClinicRecommendations(req: Request, res: Response) {
    const profile = PublicController.normalizeDiscoveryPayload(req.body);
    const profiles = await PublicController.listPublishedProfiles();
    const tenantIds = Array.from(new Set(profiles.map((row) => row.tenant_id)));
    const tenants = tenantIds.length ? await AppDataSource.getRepository(Tenant).find({ where: { id: In(tenantIds) } as any }) : [];
    const syncedTenants = await Promise.all(tenants.map((row) => TenantLifecycleService.syncTenantState(row)));
    const tenantMap = new Map(syncedTenants.filter(Boolean).map((row) => [row!.id, row!]));

    const recommendations = profiles
      .map((row) => {
        const tenant = tenantMap.get(row.tenant_id);
        if (!PublicController.isTenantPublic(tenant)) return null;
        const score = PublicController.computeRecommendationScore(profile, row, tenant!);
        return {
          slug: row.slug,
          title: row.hero_title || tenant?.name || "Klinik",
          subtitle: row.hero_subtitle || "Profilinle uyumlu görünen klinik akışı.",
          tags: PublicController.buildRecommendationTags(profile, row),
          match_score: score,
        };
      })
      .filter(Boolean)
      .map((row) => row as NonNullable<typeof row>)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5);

    return res.json({ data: { recommendations } });
  }

  static async getPlanRecommendation(req: Request, res: Response) {
    const profile = PublicController.normalizeDiscoveryPayload(req.body);
    const packageType = PublicController.recommendPackageType(profile);
    const planMap: Record<string, { id: string; name: string; price_label: string; subtitle: string }> = {
      STARTER: { id: "starter", name: "Starter", price_label: "Klinik bazlı başlangıç planı", subtitle: "Daha kontrollü başlangıç, daha az sürtünme." },
      BALANCE: { id: "balance", name: "Balance", price_label: "Orta yoğunlukta takip planı", subtitle: "Düzen kurmak ve devamlılık kazanmak için dengeli öneri." },
      FOCUS: { id: "focus", name: "Focus", price_label: "Yoğun takip başlangıç planı", subtitle: "Daha sık temas ve daha yakın uzman takibi için." },
    };
    return res.json({
      data: {
        recommended_plan: planMap[packageType] || planMap.BALANCE,
        explanation_points: PublicController.buildDiscoveryExplanation(profile),
      },
    });
  }

  static async createClinicIntake(req: Request, res: Response) {
    const payload = PublicController.normalizeClinicIntake(req.body);
    const plan = PublicController.recommendClinicPlan(payload);
    const modules = PublicController.recommendClinicModules(payload);

    return res.json({
      data: {
        recommended_plan: plan,
        recommended_modules: modules,
        estimated_roi_copy: `${payload.active_client_count} aktif danisan ve ${payload.staff_count} kisilik ekipte, ilk etki daha hizli operasyon ve daha az dağinik takip olur.`,
        price_preview: plan.price_label,
      },
    });
  }

  static async createDemoLead(req: Request, res: Response) {
    const website = String(req.body?.website ?? "").trim();
    if (website) {
      return res.status(202).json({ message: "Demo talebiniz alındı." });
    }

    const fullName = String(req.body?.full_name ?? "").trim();
    const clinicName = String(req.body?.clinic_name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const city = String(req.body?.city ?? "").trim();
    const note = String(req.body?.note ?? "").trim();
    const clinicType = String(req.body?.clinic_type ?? "").trim().slice(0, 80);
    const primaryNeed = String(req.body?.primary_need ?? "").trim().slice(0, 80);
    const attribution = String(req.body?.attribution ?? "").trim().slice(0, 160);
    const pagePath = String(req.body?.page_path ?? "").trim().slice(0, 240);
    const consent = Boolean(req.body?.consent);
    const { phoneClean } = PublicController.normalizePhone(req.body?.phone);

    if (fullName.length < 2) throw new AppError("VALIDATION_ERROR", 400, "Ad Soyad en az 2 karakter olmalıdır");
    if (clinicName.length < 2) throw new AppError("VALIDATION_ERROR", 400, "Klinik adı en az 2 karakter olmalıdır");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError("VALIDATION_ERROR", 400, "Geçerli bir e-posta adresi girilmelidir");
    if (!phoneClean || phoneClean.length < 7 || phoneClean.length > 15) throw new AppError("VALIDATION_ERROR", 400, "Geçersiz telefon numarası");
    if (city.length > 100) throw new AppError("VALIDATION_ERROR", 400, "Şehir/ilçe alanı çok uzun");
    if (note.length > 1200) throw new AppError("VALIDATION_ERROR", 400, "Not çok uzun");
    if (!consent) throw new AppError("VALIDATION_ERROR", 400, "Demo talebi için aydınlatma metni onayı gereklidir");

    await AuditLogService.log({
      tenant_id: null,
      actor_role: "PUBLIC",
      event_type: "PRODUCT_SITE_DEMO_LEAD_SUBMIT",
      action: "PRODUCT_SITE_DEMO_LEAD_SUBMIT",
      method: req.method,
      path: req.originalUrl,
      status_code: 202,
      success: true,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "product_demo_lead",
      target_id: null,
      metadata: {
        source: "PRODUCT_SITE_DEMO",
        full_name: fullName,
        clinic_name: clinicName,
        email,
        phone: phoneClean,
        city: city || null,
        note: note || null,
        clinic_type: clinicType || null,
        primary_need: primaryNeed || null,
        attribution: attribution || null,
        page_path: pagePath || null,
      },
    });

    const emailDelivery = await DemoLeadEmailService.send({
      fullName,
      email,
      clinicName,
      phone: phoneClean,
      city: city || null,
      clinicType: clinicType || null,
      primaryNeed: primaryNeed || null,
      note: note || null,
      attribution: attribution || null,
      pagePath: pagePath || null,
    });
    if (emailDelivery.errors.length > 0) {
      console.error("Demo lead email delivery error:", emailDelivery.errors.join("; "));
    }

    await AuditLogService.log({
      tenant_id: null,
      actor_role: "SYSTEM",
      event_type: "PRODUCT_SITE_DEMO_LEAD_EMAIL",
      action: "PRODUCT_SITE_DEMO_LEAD_EMAIL",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: emailDelivery.adminDelivered && emailDelivery.applicantDelivered,
      target_type: "product_demo_lead",
      metadata: {
        email,
        smtp_configured: emailDelivery.configured,
        admin_delivered: emailDelivery.adminDelivered,
        applicant_delivered: emailDelivery.applicantDelivered,
        errors: emailDelivery.errors,
      },
    });

    return res.status(202).json({ message: "Demo talebiniz alındı. Fizyoflow ekibi kısa sürede sizinle iletişime geçecek." });
  }

  // --- POST /salons/:slug/leads ---
  static async createLead(req: Request, res: Response) {
    try {
      const slug = PublicController.getSlug(req);
      if (!slug) {
        throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");
      }

      const fullName = String(req.body?.full_name ?? "").trim();
      const interest = typeof req.body?.interest === "string" ? req.body.interest.trim() : undefined;
      const availabilityNote =
        typeof req.body?.availability_note === "string" ? req.body.availability_note.trim() : undefined;
      const leadSource = String(req.body?.source ?? "").trim().slice(0, 80) || null;
      const attribution = String(req.body?.attribution ?? "").trim().slice(0, 160) || null;
      const pagePath = String(req.body?.page_path ?? "").trim().slice(0, 240) || null;

      const { phoneClean } = PublicController.normalizePhone(req.body?.phone);

      // Validation: isim + telefon
      if (fullName.length < 2) {
        throw new AppError("VALIDATION_ERROR", 400, "Ad Soyad en az 2 karakter olmalıdır");
      }
      // Telefon: sadece rakam ve makul uzunluk (7-15)
      if (!phoneClean || phoneClean.length < 7 || phoneClean.length > 15) {
        throw new AppError("VALIDATION_ERROR", 400, "Geçersiz telefon numarası");
      }

      // Opsiyonel: alan uzunluğu limitleri (DB şişmesin)
      if (interest && interest.length > 80) {
        throw new AppError("VALIDATION_ERROR", 400, "İlgi alanı çok uzun");
      }
      if (availabilityNote && availabilityNote.length > 2000) {
        throw new AppError("VALIDATION_ERROR", 400, "Not çok uzun");
      }

      const context = await PublicController.resolvePublicSalonContext(slug);
      if (!context.tenant) {
        throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
      }

      const leadRepo = AppDataSource.getRepository(Lead);

      // Basit dedupe (opsiyonel ama tavsiye): aynı tenant + phone için açık NEW varsa tekrar açma
      const existing = await leadRepo.findOne({
        where: {
          tenant_id: context.tenant.id,
          phone: phoneClean,
          status: LeadStatus.NEW,
        },
      });

      if (existing) {
        // İstersen burada 200 dönüp "zaten var" diyebilirsin
        throw new AppError("LEAD_EXISTS", 409, "Bu telefon numarasıyla zaten açık bir lead var");
      }

      const newLead = leadRepo.create({
        tenant_id: context.tenant.id,
        full_name: fullName,
        phone: phoneClean,
        interest,
        availability_note: availabilityNote,
      });

      await leadRepo.save(newLead);
      await AuditLogService.log({
        tenant_id: context.tenant.id,
        actor_role: "PUBLIC",
        event_type: "PUBLIC_LEAD_CREATED",
        action: "PUBLIC_LEAD_CREATED",
        method: req.method,
        path: req.originalUrl,
        status_code: 201,
        success: true,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "lead",
        target_id: newLead.id,
        metadata: {
          tenant_slug: context.tenant.slug,
          phone: phoneClean,
          full_name: fullName,
          interest: interest || null,
          source: leadSource,
          attribution,
          page_path: pagePath,
        },
      });

      return res.status(201).json({ message: "Lead başarıyla oluşturuldu", lead_id: newLead.id });
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // AppError ise olduğu gibi fırlat
      }
      console.error("Lead oluşturulurken hata:", error);
      throw new AppError("LEAD_CREATION_ERROR", 500, "Lead oluşturulurken hata oluştu");
    }
  }

  static async trackSalonEvent(req: Request, res: Response) {
    const slug = PublicController.getSlug(req);
    if (!slug) throw new AppError("INVALID_SLUG", 400, "Geçersiz slug");

    const eventType = String(req.body?.event_type ?? "").trim().toUpperCase();
    const allowedEvents = new Set([
      "PAGE_VIEW",
      "LEAD_SUBMIT",
      "WHATSAPP_CLICK",
      "PHONE_CLICK",
      "MAP_CLICK",
      "INSTAGRAM_CLICK",
      "REVIEW_CLICK",
      "SECTION_VIEW",
    ]);
    if (!allowedEvents.has(eventType)) {
      throw new AppError("VALIDATION_ERROR", 400, "Geçersiz etkinlik türü");
    }

    const context = await PublicController.resolvePublicSalonContext(slug);
    if (!context.tenant) {
      throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
    }

    const source = String(req.body?.source ?? "").trim().slice(0, 80) || null;
    const pagePath = String(req.body?.page_path ?? "").trim().slice(0, 240) || null;
    const section = String(req.body?.section ?? "").trim().slice(0, 80) || null;

    await AuditLogService.log({
      tenant_id: context.tenant.id,
      actor_role: "PUBLIC",
      event_type: `PUBLIC_SITE_${eventType}`,
      action: `PUBLIC_SITE_${eventType}`,
      method: req.method,
      path: req.originalUrl,
      status_code: 202,
      success: true,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "public_site",
      target_id: context.tenant.id,
      metadata: {
        tenant_slug: context.tenant.slug,
        source,
        page_path: pagePath,
        section,
      },
    });

    return res.status(202).json({ ok: true });
  }

  static async listCities(_req: Request, res: Response) {
    const profiles = await PublicController.listPublishedProfiles();
    const tenantIds = Array.from(new Set(profiles.map((row) => row.tenant_id)));
    const tenants = tenantIds.length ? await AppDataSource.getRepository(Tenant).find({ where: { id: In(tenantIds) } as any }) : [];
    const syncedTenants = await Promise.all(tenants.map((row) => TenantLifecycleService.syncTenantState(row)));
    const tenantMap = new Map(syncedTenants.filter(Boolean).map((row) => [row!.id, row!]));
    const cities = Array.from(
      new Set(
        profiles
          .filter((row) => PublicController.isTenantPublic(tenantMap.get(row.tenant_id)))
          .map((row) => {
            const location = row.location && typeof row.location === "object" && !Array.isArray(row.location) ? (row.location as Record<string, unknown>) : {};
            return String(location.city ?? location.address ?? "").trim();
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));

    return res.json({ data: cities.map((city) => ({ value: city, label: city })) });
  }

  static async listSalons(req: Request, res: Response) {
    const city = String(req.query.city ?? "").trim().toLowerCase();
    const profiles = await PublicController.listPublishedProfiles();
    const tenantIds = Array.from(new Set(profiles.map((row) => row.tenant_id)));
    const tenants = tenantIds.length
      ? await AppDataSource.getRepository(Tenant).find({ where: { id: In(tenantIds) } as any })
      : [];
    const publicPackages = tenantIds.length
      ? await AppDataSource.getRepository(Package).find({
          where: {
            tenant_id: In(tenantIds),
            is_active: true,
            is_public: true,
            is_visible: true,
          } as any,
          order: { created_at: "DESC" as any },
        })
      : [];
    const syncedTenants = await Promise.all(tenants.map((row) => TenantLifecycleService.syncTenantState(row)));
    const tenantMap = new Map(syncedTenants.filter(Boolean).map((row) => [row!.id, row!]));
    const packagesByTenant = PublicController.groupPackagesByTenant(publicPackages);
    const memberCountsByPackage = publicPackages.length
      ? await PublicController.getActiveMemberCountsByPackage(publicPackages.map((row) => row.id))
      : new Map<string, number>();

    const rows = profiles
      .map((profile) => {
        const location = profile.location && typeof profile.location === "object" && !Array.isArray(profile.location) ? (profile.location as Record<string, unknown>) : {};
        const resolvedCity = String(location.city ?? location.address ?? "").trim();
        const tenant = tenantMap.get(profile.tenant_id);
        if (!PublicController.isTenantPublic(tenant)) {
          return null;
        }
        return {
          id: tenant?.id || profile.tenant_id,
          name: tenant?.name || profile.hero_title || "Salon",
          slug: profile.slug,
          tenant_id: profile.tenant_id,
          tenant_name: tenant?.name || profile.hero_title || "Salon",
          city: resolvedCity,
          district: String(location.district ?? "").trim() || null,
          hero_title: profile.hero_title,
          hero_subtitle: profile.hero_subtitle,
          hero_image_url: profile.hero_image_url || null,
          primary_color: profile.primary_color || "#0EA5E9",
          services: PublicController.buildPublicServiceCatalog(packagesByTenant.get(profile.tenant_id), profile.services, memberCountsByPackage),
          is_boosted: TenantLifecycleService.isBoosted(tenant),
          boost_label: TenantLifecycleService.isBoosted(tenant) ? "One Cikan" : null,
        };
      })
      .filter(Boolean)
      .map((row) => row as NonNullable<typeof row>)
      .filter((row) => !city || row.city.toLowerCase() === city);

    rows.sort((a, b) => {
      if (a.is_boosted === b.is_boosted) return a.tenant_name.localeCompare(b.tenant_name, "tr");
      return a.is_boosted ? -1 : 1;
    });

    return res.json({ data: rows });
  }

  private static getSlug(req: Request): string {
    return String(req.params.slug ?? "").trim().toLowerCase();
  }

  private static async resolvePublicSalonContext(slug: string): Promise<{ tenant: Tenant | null; profile: SalonProfile | null }> {
    if (!slug || isReservedPublicSlug(slug)) {
      return { tenant: null, profile: null };
    }

    const profileRepo = AppDataSource.getRepository(SalonProfile);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const publishedBySlug = await profileRepo.findOne({
      where: { slug, is_published: true },
      order: { updated_at: "DESC" as any },
    });
    if (publishedBySlug) {
      const tenant = await TenantLifecycleService.syncTenantState(await tenantRepo.findOne({ where: { id: publishedBySlug.tenant_id } }));
      if (PublicController.isTenantPublic(tenant)) {
        return { tenant, profile: publishedBySlug };
      }
    }

    const tenant = await TenantLifecycleService.syncTenantState(await tenantRepo.findOne({ where: { slug, is_active: true } }));
    if (!tenant) {
      return { tenant: null, profile: null };
    }
    if (!PublicController.isTenantPublic(tenant)) {
      return { tenant: null, profile: null };
    }

    const publishedByTenant = await profileRepo.findOne({
      where: { tenant_id: tenant.id, is_published: true },
      order: { updated_at: "DESC" as any },
    });

    if (publishedByTenant) {
      return { tenant, profile: publishedByTenant };
    }
    return { tenant: null, profile: null };
  }

  private static buildFallbackProfile(tenant: Tenant, slug: string): Partial<SalonProfile> & { tenant_id: string; slug: string } {
    return {
      tenant_id: tenant.id,
      slug,
      hero_title: tenant.name || "FizyoFlow Salon",
      hero_subtitle: "Salon profili hazırlanıyor. Güncel bilgiler yakında yayınlanacak.",
      about_text: "",
      why_us: [],
      services: [],
      location: {},
      social_links: {},
      theme: "fizyoflow-v2",
      primary_color: "#0EA5E9",
      business_hours: {
        timezone: tenant.timezone || "Europe/Istanbul",
        working_days: [1, 2, 3, 4, 5, 6],
        start_time: "09:00",
        end_time: "18:00",
        lunch_break_start: "12:00",
        lunch_break_end: "13:00",
        slot_minutes: 60,
      },
      is_published: true,
    };
  }

  private static normalizePhone(raw: unknown): { phoneClean: string } {
    const phoneClean = String(raw ?? "").replace(/\D/g, "");
    return { phoneClean };
  }

  private static normalizeDiscoveryPayload(raw: unknown) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const toStringArray = (value: unknown) =>
      Array.isArray(value) ? value.map((row) => String(row || "").trim()).filter(Boolean) : [];

    return {
      goals: toStringArray(source.goals),
      attendance_preference: String(source.attendance_preference || "").trim() || "Haftada 2-3 gun",
      support_preference: String(source.support_preference || "").trim() || "Uzman takibi istiyorum",
      age_band: String(source.age_band || "").trim() || "25-34",
      mobility_or_health_flags: toStringArray(source.mobility_or_health_flags),
      environment_preference: String(source.environment_preference || "").trim() || "Premium ve ozel",
      time_preferences: toStringArray(source.time_preferences),
      budget_band: String(source.budget_band || "").trim() || "Orta",
      answers: Array.isArray(source.answers) ? source.answers : [],
    };
  }

  private static buildDiscoverySummary(profile: ReturnType<typeof PublicController.normalizeDiscoveryPayload>) {
    const goal = profile.goals[0] || "duzenli saglik";
    const time = profile.time_preferences[0] || "esnek saatler";
    return `${goal} odağın için ${profile.environment_preference.toLowerCase()} bir deneyim, ${time.toLowerCase()} uygunluğu ve ${profile.support_preference.toLowerCase()} beklentisi öne çıkıyor.`;
  }

  private static buildDiscoveryExplanation(profile: ReturnType<typeof PublicController.normalizeDiscoveryPayload>) {
    return [
      `${profile.attendance_preference} ritmine uygun bir başlangıç önerildi.`,
      `${profile.support_preference} ihtiyacı plan tonunu belirledi.`,
      `${profile.environment_preference} beklentisi klinik eşleştirmesinde ağırlık aldı.`,
    ];
  }

  private static recommendPackageType(profile: ReturnType<typeof PublicController.normalizeDiscoveryPayload>) {
    const attendance = profile.attendance_preference.toLowerCase();
    if (attendance.includes("4") || attendance.includes("5") || attendance.includes("yogun")) return "FOCUS";
    if (attendance.includes("1") || attendance.includes("hafif")) return "STARTER";
    return "BALANCE";
  }

  private static computeRecommendationScore(
    profile: ReturnType<typeof PublicController.normalizeDiscoveryPayload>,
    salonProfile: SalonProfile,
    tenant: Tenant
  ) {
    let score = TenantLifecycleService.isBoosted(tenant) ? 12 : 0;
    const subtitle = String(salonProfile.hero_subtitle || "").toLowerCase();
    const about = String(salonProfile.about_text || "").toLowerCase();
    const haystack = `${subtitle} ${about}`;
    for (const goal of profile.goals) {
      if (haystack.includes(goal.toLowerCase())) score += 18;
    }
    if (haystack.includes(profile.environment_preference.toLowerCase().split(" ")[0])) score += 20;
    if (profile.support_preference.toLowerCase().includes("uzman")) score += 15;
    if (profile.time_preferences.some((item) => haystack.includes(item.toLowerCase()))) score += 10;
    return Math.max(52, Math.min(98, score));
  }

  private static buildRecommendationTags(profile: ReturnType<typeof PublicController.normalizeDiscoveryPayload>, salonProfile: SalonProfile) {
    return [
      profile.environment_preference,
      profile.support_preference,
      String(salonProfile.location && typeof salonProfile.location === "object" ? (salonProfile.location as Record<string, unknown>).city || "Sehir" : "Sehir"),
    ].filter(Boolean);
  }

  private static normalizeClinicIntake(raw: unknown) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const priorities = Array.isArray(source.priority_jobs_to_solve) ? source.priority_jobs_to_solve.map((row) => String(row || "").trim()).filter(Boolean) : [];
    return {
      clinic_size: String(source.clinic_size || "").trim() || "orta",
      staff_count: Math.max(1, Number(source.staff_count || 1)),
      specialist_count: Math.max(1, Number(source.specialist_count || 1)),
      active_client_count: Math.max(0, Number(source.active_client_count || 0)),
      branch_count: Math.max(1, Number(source.branch_count || 1)),
      tone: String(source.tone || "").trim() || "kurumsal-sicak",
      age_mix: String(source.age_mix || "").trim() || "25-44",
      events_or_group_classes: Boolean(source.events_or_group_classes),
      priority_jobs_to_solve: priorities,
    };
  }

  private static recommendClinicPlan(payload: ReturnType<typeof PublicController.normalizeClinicIntake>) {
    const volumeScore = payload.active_client_count + payload.staff_count * 4 + payload.branch_count * 12;
    if (volumeScore >= 120 || payload.branch_count > 1) {
      return {
        id: "pro",
        name: "Pro",
        price_label: "Aylik premium operasyon paketi",
        subtitle: "Coklu ekip, yogun uye takibi ve gelir gorunurlugu icin.",
      };
    }
    if (volumeScore <= 35) {
      return {
        id: "starter",
        name: "Starter",
        price_label: "Aylik giris paketi",
        subtitle: "Kucuk ekip ve sade operasyon kurulumu icin.",
      };
    }
    return {
      id: "growth",
      name: "Growth",
      price_label: "Aylik buyume paketi",
      subtitle: "Günlük operasyonu mobilden toplamak isteyen klinikler icin.",
    };
  }

  private static recommendClinicModules(payload: ReturnType<typeof PublicController.normalizeClinicIntake>) {
    const modules = ["Mobil dashboard", "Onay merkezi", "Uye ve ekip takibi"];
    if (payload.events_or_group_classes) modules.push("Takvim ve grup ders planlama");
    if (payload.priority_jobs_to_solve.some((row) => row.toLowerCase().includes("odeme"))) modules.push("Odeme ve abonelik gorunurlugu");
    if (payload.active_client_count > 40) modules.push("Risk ve devamlilik sinyalleri");
    return modules;
  }

  private static buildDayOptions(businessHours?: Record<string, unknown>) {
    const now = new Date();
    const workingDays = Array.isArray(businessHours?.working_days) ? (businessHours?.working_days as number[]) : [1, 2, 3, 4, 5, 6];
    const startMinutes = PublicController.toMinutes(String(businessHours?.start_time || "09:00"));
    const endMinutes = PublicController.toMinutes(String(businessHours?.end_time || "18:00"));
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const slotMinutes = Math.max(15, Math.min(180, Number(businessHours?.slot_minutes || 60)));
    const breakMinutes = Math.max(0, Math.min(60, Number(businessHours?.break_duration_minutes || 0)));
    const flowLabel = `${slotMinutes} dk ders`;

    const rows: Array<{ starts_at: string; ends_at: string; label: string; weekday: number; weekday_label: string; time_range_label: string }> = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const isoDay = dayIndex + 1;
      if (!workingDays.includes(isoDay)) continue;
      for (let minute = startMinutes; minute < endMinutes; minute += slotMinutes + breakMinutes) {
        const slotEndMinute = minute + slotMinutes;
        const lunchStart = PublicController.toMinutes(String(businessHours?.lunch_break_start || "12:00"));
        const lunchEnd = PublicController.toMinutes(String(businessHours?.lunch_break_end || "13:00"));
        if (slotEndMinute > endMinutes) continue;
        if (minute < lunchEnd && slotEndMinute > lunchStart) continue;

        const startsAt = new Date(startOfWeek);
        startsAt.setDate(startOfWeek.getDate() + dayIndex);
        startsAt.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
        const endsAt = new Date(startOfWeek);
        endsAt.setDate(startOfWeek.getDate() + dayIndex);
        endsAt.setHours(Math.floor(slotEndMinute / 60), slotEndMinute % 60, 0, 0);
        const weekdayLabel = PublicController.WEEKDAY_LABELS[dayIndex] || `Gun ${isoDay}`;
        rows.push({
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          label: `${weekdayLabel} • ${startsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
          weekday: isoDay,
          weekday_label: weekdayLabel,
          time_range_label: `${startsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${endsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • ${flowLabel}`,
        });
      }
    }
    return rows;
  }

  private static deriveWeeklyClassHours(pkg?: Pick<Package, "total_credits" | "duration_days" | "rules"> | null) {
    const rules = pkg?.rules && typeof pkg.rules === "object" ? (pkg.rules as Record<string, unknown>) : {};
    const explicit = Number(rules.weekly_class_hours ?? rules.weekly_sessions ?? rules.sessions_per_week ?? 0);
    if (Number.isFinite(explicit) && explicit >= 1) {
      return Math.min(7, Math.max(1, Math.floor(explicit)));
    }
    const durationDays = Number(pkg?.duration_days || 0);
    const totalCredits = Number(pkg?.total_credits || 0);
    if (durationDays > 0 && totalCredits > 0) {
      return Math.min(7, Math.max(1, Math.round(totalCredits / Math.max(1, durationDays / 7))));
    }
    if (totalCredits > 0) {
      return Math.min(7, Math.max(1, Math.round(totalCredits / 4)));
    }
    return 1;
  }

  private static parseSelectedDays(raw: unknown) {
    if (typeof raw !== "string" || !raw.trim()) return [] as Array<{ starts_at: Date; ends_at: Date }>;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => {
          const item = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
          const startsAt = item?.starts_at ? new Date(String(item.starts_at)) : null;
          const endsAt = item?.ends_at ? new Date(String(item.ends_at)) : null;
          if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
            return null;
          }
          return { starts_at: startsAt, ends_at: endsAt };
        })
        .filter((row): row is { starts_at: Date; ends_at: Date } => Boolean(row));
    } catch {
      return [];
    }
  }

  private static parsePackageIds(raw: unknown) {
    if (typeof raw !== "string" || !raw.trim()) return [] as string[];
    return raw
      .split(",")
      .map((row) => row.trim())
      .filter((row) => PublicController.UUID_PATTERN.test(row));
  }

  private static async buildGroupClassDayOptions(tenantId: string, packages: Package[], businessHours?: Record<string, unknown>) {
    if (!packages.length) return [] as PurchaseDayOptionRow[];

    const hasDropInGroupPackage = packages.some((pkg) => {
      const rules = pkg.rules && typeof pkg.rules === "object" ? (pkg.rules as Record<string, unknown>) : {};
      const lessonMode = String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase();
      const allowDropInBooking =
        typeof rules.allow_drop_in_booking === "boolean" ? rules.allow_drop_in_booking : lessonMode === "GROUP";
      return allowDropInBooking;
    });

    if (!hasDropInGroupPackage) return [] as PurchaseDayOptionRow[];

    const allowedCategories = Array.from(new Set(packages.flatMap((pkg) => PublicController.packageToLessonCategories(pkg.type))));
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + 21);

    const sessions = await AppDataSource.getRepository(ClassSession)
      .createQueryBuilder("session")
      .where("session.tenant_id = :tenantId", { tenantId })
      .andWhere("session.type = :type", { type: SessionType.GROUP })
      .andWhere("session.status = :status", { status: SessionStatus.SCHEDULED })
      .andWhere("session.starts_at >= :now", { now })
      .andWhere("session.starts_at <= :until", { until })
      .andWhere(allowedCategories.length > 0 ? "session.lesson_category IN (:...allowedCategories)" : "1=1", { allowedCategories })
      .orderBy("session.starts_at", "ASC")
      .getMany();

    const countMap = await GroupClassService.getJoinedCountsBySessionIds(
      tenantId,
      sessions.map((session) => session.id)
    );

    const workingDays = Array.isArray(businessHours?.working_days) ? (businessHours?.working_days as number[]) : [1, 2, 3, 4, 5, 6];

    return sessions
      .map((session) => {
      const startsAt = new Date(session.starts_at);
      const endsAt = new Date(session.ends_at);
      const weekdayIndex = (startsAt.getDay() + 6) % 7;
      const weekday = weekdayIndex + 1;
      const weekdayLabel = PublicController.WEEKDAY_LABELS[weekdayIndex] || `Gun ${weekday}`;
      const startLabel = startsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const endLabel = endsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const counts = countMap.get(session.id);
      const packageRow =
        packages.find((pkg) => pkg.id === session.related_package_id) ||
        packages.find((pkg) =>
          PublicController.packageToLessonCategories(pkg.type).includes(session.lesson_category)
        ) ||
        packages[0];
      return {
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        label: `${weekdayLabel} • ${startLabel}`,
        package_id: packageRow?.id || session.related_package_id || null,
        package_title: packageRow?.title || null,
        weekday,
        weekday_label: weekdayLabel,
        time_range_label: `${startLabel} - ${endLabel} • Grup dersi`,
        lesson_name: session.title,
        group_class_id: session.id,
        group_title: session.title,
        is_group_class: true,
        is_recurring: Boolean(session.recurrence_label),
        recurrence_label: session.recurrence_label ?? null,
        special_date: session.special_date ?? null,
        price: session.price ?? packageRow?.display_price ?? null,
        capacity: session.capacity,
        joined_count: counts?.joined || 0,
        notification_scope: session.notification_scope,
        requires_admin_approval: session.requires_admin_approval,
        trainer_can_invite_members: true,
      };
      })
      .filter((row) => workingDays.includes(row.weekday));
  }

  private static async countTrainerFreeSlotsByTrainer(
    tenantId: string,
    trainerIds: string[],
    slots: Array<{ starts_at: Date; ends_at: Date }>
  ) {
    if (trainerIds.length === 0 || slots.length === 0) {
      return new Map<string, number>();
    }
    const minStart = new Date(Math.min(...slots.map((slot) => slot.starts_at.getTime())));
    const maxEnd = new Date(Math.max(...slots.map((slot) => slot.ends_at.getTime())));
    const bookings = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.trainer_id IN (:...trainerIds)", { trainerIds })
      .andWhere("b.status IN (:...statuses)", { statuses: PublicController.BLOCKING_BOOKING_STATUSES })
      .andWhere("b.starts_at < :maxEnd", { maxEnd })
      .andWhere("b.ends_at > :minStart", { minStart })
      .getMany();

    const bookingMap = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const current = bookingMap.get(booking.trainer_id) || [];
      current.push(booking);
      bookingMap.set(booking.trainer_id, current);
    }

    const result = new Map<string, number>();
    for (const trainerId of trainerIds) {
      const trainerBookings = bookingMap.get(trainerId) || [];
      let freeCount = 0;
      for (const slot of slots) {
        const conflict = trainerBookings.some((booking) => booking.starts_at < slot.ends_at && booking.ends_at > slot.starts_at);
        if (!conflict) freeCount += 1;
      }
      result.set(trainerId, freeCount);
    }
    return result;
  }

  private static toMinutes(value: string) {
    const [hour, minute] = value.split(":").map((row) => Number(row || 0));
    return hour * 60 + minute;
  }

  private static packageToLessonCategories(type?: PackageType | null) {
    if (!type) return [] as LessonCategory[];
    switch (type) {
      case PackageType.GROUP:
        return [LessonCategory.GRUP, LessonCategory.PILATES];
      case PackageType.REFORMER:
        return [LessonCategory.REFORMER];
      case PackageType.PT:
        return [LessonCategory.PT];
      case PackageType.SCOLIOSIS:
        return [LessonCategory.SKOLYOZ];
      default:
        return [];
    }
  }

  private static groupPackagesByTenant(rows: Package[]) {
    const map = new Map<string, Package[]>();
    for (const row of rows) {
      const current = map.get(row.tenant_id) || [];
      current.push(row);
      map.set(row.tenant_id, current);
    }
    return map;
  }

  private static buildPublicServiceCatalog(packages: Package[] | undefined, fallbackServices: unknown, memberCountsByPackage?: Map<string, number>) {
    const fromPackages = Array.isArray(packages)
      ? packages
          .map((row) => {
            const rules = row.rules && typeof row.rules === "object" ? (row.rules as Record<string, unknown>) : {};
            const title = String(rules.service_name ?? row.title ?? "").trim();
            if (!title) {
              return null;
            }

            return {
              title,
              starting_price: row.display_price ?? null,
              summary: String(rules.summary ?? "").trim() || null,
              active_member_count: memberCountsByPackage?.get(row.id) || 0,
            };
          })
          .filter((row): row is { title: string; starting_price: string | null; summary: string | null; active_member_count: number } => Boolean(row))
      : [];

    if (fromPackages.length > 0) {
      const deduped = new Map<string, { title: string; starting_price: string | null; summary: string | null; active_member_count: number }>();
      for (const row of fromPackages) {
        const key = row.title.toLocaleLowerCase("tr");
        if (!deduped.has(key) || (deduped.get(key)?.active_member_count || 0) < row.active_member_count) {
          deduped.set(key, row);
        }
      }
      return Array.from(deduped.values());
    }

    return Array.isArray(fallbackServices) ? fallbackServices : [];
  }

  private static async getActiveMemberCountsByPackage(packageIds: string[], tenantId?: string) {
    if (packageIds.length === 0) return new Map<string, number>();

    const rows = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("user_package")
      .select("user_package.package_id", "package_id")
      .addSelect("COUNT(*)::int", "active_member_count")
      .where("user_package.package_id IN (:...packageIds)", { packageIds })
      .andWhere("user_package.is_active = true");

    if (tenantId) {
      rows.andWhere("user_package.tenant_id = :tenantId", { tenantId });
    }

    const rawRows = await rows.groupBy("user_package.package_id").getRawMany<{ package_id: string; active_member_count: string }>();
    return new Map(rawRows.map((row) => [String(row.package_id), Number(row.active_member_count) || 0]));
  }

  private static async listPublishedProfiles() {
    const rows = await AppDataSource.getRepository(SalonProfile).find({
      where: { is_published: true },
      order: { updated_at: "DESC" as any },
    });

    const latestByTenant = new Map<string, SalonProfile>();
    for (const row of rows) {
      if (!row.slug || isReservedPublicSlug(row.slug)) {
        continue;
      }
      if (!latestByTenant.has(row.tenant_id)) {
        latestByTenant.set(row.tenant_id, row);
      }
    }

    return Array.from(latestByTenant.values());
  }

  private static isTenantPublic(tenant: Tenant | null | undefined) {
    return Boolean(
      tenant &&
        tenant.is_active &&
        tenant.is_public &&
        tenant.review_status === TenantReviewStatus.PUBLISHED &&
        [TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE].includes(tenant.subscription_status)
    );
  }
}

type PurchaseDayOptionRow = {
  starts_at: string;
  ends_at: string;
  label: string;
  weekday: number;
  weekday_label: string;
  time_range_label: string;
  lesson_name?: string | null;
  group_class_id?: string | null;
  group_title?: string | null;
  is_group_class?: boolean | null;
  capacity?: number | null;
};
