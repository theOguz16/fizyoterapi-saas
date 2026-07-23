// Bu controller admin tarafindaki packages.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Package, PackageType } from "../../entities/package.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { ClassSession, SessionStatus, SessionType } from "../../entities/class-session.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import {
  catalogLabelForCode,
  derivePackageFromCatalog,
  enrichPackageRowForDisplay,
  normalizeLessonCatalogServices,
} from "../../services/package.service";

export class AdminPackagesController {
  private static async logPackageAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      pkg: Package;
      oldState?: Record<string, unknown> | null;
    }
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: input.eventType,
      action: input.eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "package",
      target_id: input.pkg.id,
      metadata: {
        package_id: input.pkg.id,
        title: input.pkg.title,
        type: input.pkg.type,
        total_credits: input.pkg.total_credits,
        duration_days: input.pkg.duration_days,
        is_active: input.pkg.is_active,
        is_visible: input.pkg.is_visible,
        is_public: input.pkg.is_public,
        old_state: input.oldState ?? null,
      },
    });
  }

  private static parseNonNegativeInt(value: unknown, field: string, fallback?: number) {
    if (value === undefined || value === null || value === "") {
      if (fallback !== undefined) return fallback;
      throw new AppError("VALIDATION_ERROR", 400, `${field} alanı zorunludur`);
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} geçerli bir tam sayı olmalıdır`);
    }
    if (parsed < 0) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} negatif olamaz`);
    }
    return parsed;
  }

  private static parsePositiveInt(value: unknown, field: string, fallback?: number) {
    const parsed = AdminPackagesController.parseNonNegativeInt(value, field, fallback);
    if (parsed < 1) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} en az 1 olmalıdır`);
    }
    return parsed;
  }

  private static parseDecimalInRange(value: unknown, field: string, min: number, max?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || (max !== undefined && parsed > max)) {
      const range = max === undefined ? `${min} veya daha büyük` : `${min} ile ${max} arasında`;
      throw new AppError("VALIDATION_ERROR", 400, `${field} ${range} olmalıdır`);
    }
    return parsed;
  }

  private static resolveWeeklyClassHours(value: unknown, totalCredits: number, fallback?: number) {
    const legacyDefault = Math.min(7, Math.max(1, Math.round(totalCredits / 4)));
    const weeklyClassHours = AdminPackagesController.parsePositiveInt(
      value,
      "weekly_class_hours",
      fallback ?? legacyDefault
    );
    if (weeklyClassHours > 7) {
      throw new AppError("VALIDATION_ERROR", 400, "weekly_class_hours 1 ile 7 arasında olmalıdır");
    }
    if (weeklyClassHours > totalCredits) {
      throw new AppError("VALIDATION_ERROR", 400, "Haftalık ders sayısı toplam ders hakkını aşamaz");
    }
    return weeklyClassHours;
  }

  private static validatePackageType(type: unknown): asserts type is PackageType {
    if (typeof type !== "string" || !Object.values(PackageType).includes(type as PackageType)) {
      throw new AppError("VALIDATION_ERROR", 400, "Geçersiz package type");
    }
  }

  private static async loadLessonCatalog(tenantId: string) {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
    });
    return normalizeLessonCatalogServices(profile?.services);
  }

  private static titleizeCatalogLabel(value: unknown, fallback: string) {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    return raw
      .replace(/_/g, " ")
      .toLocaleLowerCase("tr-TR")
      .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase("tr-TR"));
  }

  private static lessonModeLabel(value: unknown) {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "GROUP") return "Grup";
    if (normalized === "DUO") return "Duo";
    return "Özel";
  }

  private static packageTypeLabel(value: unknown) {
    const catalogLabel = catalogLabelForCode(value);
    if (catalogLabel) return catalogLabel;
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "GROUP") return "Grup dersi";
    if (normalized === "PT") return "Özel ders";
    if (normalized === "SCOLIOSIS") return "Skolyoz";
    if (normalized === "REFORMER") return "Reformer";
    if (normalized === "MANUAL") return "Manuel terapi";
    return "Diğer";
  }

  // --- GET /api/admin/packages ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const [packages, catalog] = await Promise.all([
        AppDataSource.getRepository(Package).find({
          where: { tenant_id: tenantId },
          order: { created_at: "DESC" },
        }),
        AdminPackagesController.loadLessonCatalog(tenantId),
      ]);

      return res.json({
        data: packages.map((pkg) => enrichPackageRowForDisplay(pkg, catalog)),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package list error:", error);
      throw new AppError("ADMIN_PACKAGE_LIST_ERROR", 500, "Admin package listesi getirilirken sunucu hatası oluştu");
    }
  }

  // --- GET /api/admin/packages/form-options ---
  static async formOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const catalog = await AdminPackagesController.loadLessonCatalog(tenantId);
      const activeCatalog = catalog.filter((item) => item.active);
      const groupSessions = await AppDataSource.getRepository(ClassSession).find({
        where: {
          tenant_id: tenantId,
          type: SessionType.GROUP,
          status: SessionStatus.SCHEDULED,
        },
        order: { starts_at: "ASC" },
      });

      return res.json({
        data: {
          lesson_catalog: activeCatalog,
          session_duration_options: [45, 50, 60],
          break_duration_options: [0, 5, 10, 15, 20, 25, 30, 45, 60],
          lesson_mode_options: [
            { value: "PRIVATE", label: "Özel", suggested_capacity: 1 },
            { value: "DUO", label: "Duo", suggested_capacity: 2 },
            { value: "GROUP", label: "Grup", suggested_capacity: 4 },
          ],
          templates: activeCatalog.map((item) => {
            const values = item.capacity_label.match(/\d+/g) || [];
            const last = values.length > 0 ? values[values.length - 1] : "1";
            const suggestedCapacity = Number(last || 1);
            const categoryKey = String(item.category_group || item.package_type || "OTHER").trim();
            const lessonMode = item.lesson_mode ?? (suggestedCapacity > 2 ? "GROUP" : suggestedCapacity === 2 ? "DUO" : "PRIVATE");

            return {
              service_key: item.code,
              lesson_category: item.code,
              service_name: item.title,
              category_group: categoryKey,
              category_label: item.category_label || AdminPackagesController.titleizeCatalogLabel(categoryKey, "Diğer"),
              sub_category_key: item.code,
              sub_category_label: item.title,
              capacity_label: item.capacity_label,
              suggested_capacity: suggestedCapacity,
              starting_price: item.starting_price,
              trainer_commission_rate: item.trainer_commission_rate,
              package_type: item.package_type,
              package_type_label: catalogLabelForCode(item.code) || AdminPackagesController.packageTypeLabel(item.package_type),
              session_duration_minutes: item.session_duration_minutes ?? 45,
              break_duration_minutes: item.break_duration_minutes ?? 0,
              lesson_mode: lessonMode,
              lesson_mode_label: AdminPackagesController.lessonModeLabel(lessonMode),
              sub_lessons: item.sub_lessons ?? [],
              default_title: `${item.title} Paketi`,
            };
          }),
          linkable_group_classes: groupSessions.map((session) => ({
            id: session.id,
            lesson_name: session.title,
            title: session.title,
            starts_at: session.starts_at,
            ends_at: session.ends_at,
            special_date: session.special_date ?? null,
            recurrence_label: session.recurrence_label ?? null,
            is_group_class: true,
          })),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package form options error:", error);
      throw new AppError("ADMIN_PACKAGE_FORM_OPTIONS_ERROR", 500, "Paket form seçenekleri getirilemedi");
    }
  }

  // --- POST /api/admin/packages ---
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const {
        title,
        total_credits,
        duration_days,
        weekly_class_hours,
        is_active,
        is_visible,
        is_public,
        service_key,
        display_price,
        trainer_commission_rate,
        capacity,
        summary,
        lesson_mode,
        sub_lessons,
        session_duration_minutes,
        break_duration_minutes,
        linked_group_class_ids,
        linked_group_class_titles,
      } = req.body;

      if (total_credits === undefined) {
        throw new AppError("MISSING_FIELDS", 400, "Gerekli alan eksik: total_credits");
      }
      if (!service_key || !String(service_key).trim()) {
        throw new AppError("VALIDATION_ERROR", 400, "service_key alanı zorunludur");
      }

      const catalog = await AdminPackagesController.loadLessonCatalog(tenantId);
      const deriveResult = derivePackageFromCatalog(catalog, {
        serviceKey: service_key,
        lessonCategory: service_key,
        explicitType: undefined,
        explicitDisplayPrice: display_price,
        explicitCapacity: capacity,
        explicitCommissionRate: trainer_commission_rate,
        lessonMode: lesson_mode,
        subLessons: sub_lessons,
        sessionDurationMinutes: session_duration_minutes,
        breakDurationMinutes: break_duration_minutes,
        existingRules: {
          ...(summary !== undefined ? { summary: String(summary).trim() } : {}),
          ...(Array.isArray(linked_group_class_ids) ? { linked_group_class_ids } : {}),
          ...(Array.isArray(linked_group_class_titles) ? { linked_group_class_titles } : {}),
        },
      });
      if (deriveResult.catalogItem && !deriveResult.catalogItem.active) {
        throw new AppError("VALIDATION_ERROR", 400, "Seçilen ders kataloğu dondurulmuş durumda");
      }
      if (!deriveResult.catalogItem) {
        throw new AppError("VALIDATION_ERROR", 400, "Seçilen ders kataloğu öğesi bulunamadı");
      }

      const normalizedTitle = typeof title === "string" && title.trim()
        ? title.trim()
        : deriveResult.catalogItem
          ? `${deriveResult.catalogItem.title} Paketi`
          : "";
      if (!normalizedTitle) {
        throw new AppError("VALIDATION_ERROR", 400, "title alanı geçersiz");
      }

      const totalCredits = AdminPackagesController.parsePositiveInt(total_credits, "total_credits");
      const durationDays = AdminPackagesController.parseNonNegativeInt(duration_days, "duration_days", 0);
      const weeklyClassHours = AdminPackagesController.resolveWeeklyClassHours(weekly_class_hours, totalCredits);
      if (display_price !== undefined) {
        AdminPackagesController.parseDecimalInRange(display_price, "display_price", 0);
      }
      if (trainer_commission_rate !== undefined) {
        AdminPackagesController.parseDecimalInRange(trainer_commission_rate, "trainer_commission_rate", 0, 100);
      }
      const capacityValue = deriveResult.capacity;
      if (!Number.isInteger(capacityValue) || capacityValue < 1) {
        throw new AppError("VALIDATION_ERROR", 400, "capacity en az 1 olmalıdır");
      }

      const newPackage = new Package();
      newPackage.tenant_id = tenantId;
      newPackage.title = normalizedTitle;
      newPackage.type = deriveResult.packageType;
      newPackage.total_credits = totalCredits;
      newPackage.duration_days = durationDays;
      newPackage.capacity = capacityValue;
      newPackage.rules = {
        ...deriveResult.rules,
        weekly_class_hours: weeklyClassHours,
      };
      newPackage.display_price = deriveResult.displayPrice;
      newPackage.is_active = is_active !== undefined ? Boolean(is_active) : true;
      newPackage.is_visible = is_visible !== undefined ? Boolean(is_visible) : true;
      newPackage.is_public = is_public !== undefined ? Boolean(is_public) : false;

      const savedPackage = await AppDataSource.getRepository(Package).save(newPackage);
      await AdminPackagesController.logPackageAudit(req, {
        eventType: "ADMIN_PACKAGE_CREATED",
        pkg: savedPackage,
      });
      await AuditLogService.logProductEvent({
        event_name: "package_created",
        ...AuditLogService.productContextFromRequest(req),
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        method: req.method,
        path: req.originalUrl,
        target_type: "package",
        target_id: savedPackage.id,
        metadata: {
          package_type: savedPackage.type,
          is_public: savedPackage.is_public,
        },
      });
      return res.status(201).json({ data: savedPackage });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package oluştururken hata oluştu:", error);
      throw new AppError("ADMIN_PACKAGE_CREATE_ERROR", 500, "Admin package oluşturulurken sunucu hatası oluştu");
    }
  }

  // --- GET /api/admin/packages/:id ---
  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const packageId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const pkg = await AppDataSource.getRepository(Package).findOne({
        where: { id: packageId, tenant_id: tenantId },
      });
      if (!pkg) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Package bulunamadı");
      }
      return res.json({ data: pkg });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package getById error:", error);
      throw new AppError("ADMIN_PACKAGE_GET_ERROR", 500, "Admin package getirilirken sunucu hatası oluştu");
    }
  }

  // --- PUT /api/admin/packages/:id ---
  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const packageId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const packageRepo = AppDataSource.getRepository(Package);
      const pkg = await packageRepo.findOne({
        where: { id: packageId, tenant_id: tenantId },
      });
      if (!pkg) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Package bulunamadı");
      }
      const oldState = {
        title: pkg.title,
        type: pkg.type,
        total_credits: pkg.total_credits,
        duration_days: pkg.duration_days,
        capacity: pkg.capacity,
        display_price: pkg.display_price ?? null,
        is_active: pkg.is_active,
        is_visible: pkg.is_visible,
        is_public: pkg.is_public,
      };

      const {
        title,
        type,
        total_credits,
        duration_days,
        weekly_class_hours,
        capacity,
        rules,
        display_price,
        is_active,
        is_visible,
        is_public,
        service_key,
        lesson_category,
        trainer_commission_rate,
        summary,
        lesson_mode,
        sub_lessons,
        session_duration_minutes,
        break_duration_minutes,
        linked_group_class_ids,
        linked_group_class_titles,
      } = req.body;

      if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
          throw new AppError("VALIDATION_ERROR", 400, "title alanı geçersiz");
        }
        pkg.title = title.trim();
      }
      if (total_credits !== undefined) {
        pkg.total_credits = AdminPackagesController.parsePositiveInt(total_credits, "total_credits");
      }
      if (duration_days !== undefined) {
        pkg.duration_days = AdminPackagesController.parseNonNegativeInt(duration_days, "duration_days");
      }
      if (is_active !== undefined) pkg.is_active = Boolean(is_active);
      if (is_visible !== undefined) pkg.is_visible = Boolean(is_visible);
      if (is_public !== undefined) pkg.is_public = Boolean(is_public);

      if (type !== undefined) {
        AdminPackagesController.validatePackageType(type);
        pkg.type = type;
      }
      if (display_price !== undefined) {
        AdminPackagesController.parseDecimalInRange(display_price, "display_price", 0);
        pkg.display_price = String(display_price);
      }
      if (capacity !== undefined) {
        pkg.capacity = AdminPackagesController.parsePositiveInt(capacity, "capacity");
      }
      if (rules !== undefined) {
        pkg.rules = rules ?? {};
      }
      if (summary !== undefined) {
        const ruleObj = typeof pkg.rules === "object" && pkg.rules ? pkg.rules : {};
        pkg.rules = {
          ...(ruleObj as Record<string, unknown>),
          summary: String(summary).trim(),
        };
      }
      if (trainer_commission_rate !== undefined) {
        AdminPackagesController.parseDecimalInRange(trainer_commission_rate, "trainer_commission_rate", 0, 100);
      }

      const existingRules = typeof pkg.rules === "object" && pkg.rules ? (pkg.rules as Record<string, unknown>) : {};
      const resolvedWeeklyClassHours =
        weekly_class_hours !== undefined || total_credits !== undefined
          ? AdminPackagesController.resolveWeeklyClassHours(
              weekly_class_hours,
              pkg.total_credits,
              Number(existingRules.weekly_class_hours || undefined)
            )
          : null;
      if (resolvedWeeklyClassHours !== null) {
        pkg.rules = { ...existingRules, weekly_class_hours: resolvedWeeklyClassHours };
      }

      const hasCatalogBindingUpdate = service_key !== undefined || lesson_category !== undefined;
      if (hasCatalogBindingUpdate) {
        const catalog = await AdminPackagesController.loadLessonCatalog(tenantId);
        const deriveResult = derivePackageFromCatalog(catalog, {
          serviceKey: service_key,
          lessonCategory: lesson_category,
          explicitType: pkg.type,
          explicitDisplayPrice: display_price ?? pkg.display_price,
          explicitCapacity: capacity ?? pkg.capacity,
          explicitCommissionRate: trainer_commission_rate,
          lessonMode: lesson_mode,
          subLessons: sub_lessons,
          sessionDurationMinutes: session_duration_minutes,
          breakDurationMinutes: break_duration_minutes,
          existingRules: {
            ...(typeof pkg.rules === "object" && pkg.rules ? (pkg.rules as Record<string, unknown>) : {}),
            ...(resolvedWeeklyClassHours !== null ? { weekly_class_hours: resolvedWeeklyClassHours } : {}),
            ...(Array.isArray(linked_group_class_ids) ? { linked_group_class_ids } : {}),
            ...(Array.isArray(linked_group_class_titles) ? { linked_group_class_titles } : {}),
          },
        });

        if (!deriveResult.catalogItem) {
          throw new AppError("VALIDATION_ERROR", 400, "Seçilen ders kataloğu öğesi bulunamadı");
        }
        if (!deriveResult.catalogItem.active) {
          throw new AppError("VALIDATION_ERROR", 400, "Seçilen ders kataloğu dondurulmuş durumda");
        }

        pkg.type = deriveResult.packageType;
        pkg.display_price = deriveResult.displayPrice;
        pkg.capacity = deriveResult.capacity;
        pkg.rules = deriveResult.rules;
      } else if (
        trainer_commission_rate !== undefined ||
        lesson_mode !== undefined ||
        sub_lessons !== undefined ||
        session_duration_minutes !== undefined ||
        break_duration_minutes !== undefined ||
        linked_group_class_ids !== undefined ||
        linked_group_class_titles !== undefined
      ) {
        const ruleObj = typeof pkg.rules === "object" && pkg.rules ? pkg.rules : {};
        pkg.rules = {
          ...(ruleObj as Record<string, unknown>),
          ...(trainer_commission_rate !== undefined ? { trainer_commission_rate: Number(trainer_commission_rate) } : {}),
          ...(lesson_mode !== undefined ? { lesson_mode: String(lesson_mode).trim().toUpperCase() } : {}),
          ...(sub_lessons !== undefined ? { sub_lessons: Array.isArray(sub_lessons) ? sub_lessons : [] } : {}),
          ...(session_duration_minutes !== undefined
            ? { session_duration_minutes: AdminPackagesController.parseNonNegativeInt(session_duration_minutes, "session_duration_minutes", 45) }
            : {}),
          ...(break_duration_minutes !== undefined
            ? { break_duration_minutes: AdminPackagesController.parseNonNegativeInt(break_duration_minutes, "break_duration_minutes", 0) }
            : {}),
          ...(linked_group_class_ids !== undefined
            ? { linked_group_class_ids: Array.isArray(linked_group_class_ids) ? linked_group_class_ids.map((item: unknown) => String(item ?? "").trim()).filter(Boolean) : [] }
            : {}),
          ...(linked_group_class_titles !== undefined
            ? { linked_group_class_titles: Array.isArray(linked_group_class_titles) ? linked_group_class_titles.map((item: unknown) => String(item ?? "").trim()).filter(Boolean) : [] }
            : {}),
        };
      }

      const finalRules = typeof pkg.rules === "object" && pkg.rules ? (pkg.rules as Record<string, unknown>) : {};
      const finalWeeklyClassHours = AdminPackagesController.resolveWeeklyClassHours(
        finalRules.weekly_class_hours,
        pkg.total_credits
      );
      const finalCommission = finalRules.trainer_commission_rate;
      if (finalCommission !== undefined) {
        AdminPackagesController.parseDecimalInRange(finalCommission, "trainer_commission_rate", 0, 100);
      }
      AdminPackagesController.parseDecimalInRange(pkg.display_price ?? 0, "display_price", 0);
      AdminPackagesController.parsePositiveInt(pkg.capacity, "capacity");
      pkg.rules = { ...finalRules, weekly_class_hours: finalWeeklyClassHours };

      const updatedPackage = await packageRepo.save(pkg);
      await AdminPackagesController.logPackageAudit(req, {
        eventType: "ADMIN_PACKAGE_UPDATED",
        pkg: updatedPackage,
        oldState,
      });
      return res.json({ data: updatedPackage });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package güncellenirken hata oluştu:", error);
      throw new AppError("ADMIN_PACKAGE_UPDATE_ERROR", 500, "Admin package güncellenirken sunucu hatası oluştu");
    }
  }

  // --- PATCH /api/admin/packages/:id/status ---
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const packageId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const packageRepo = AppDataSource.getRepository(Package);
      const pkg = await packageRepo.findOne({
        where: { id: packageId, tenant_id: tenantId },
      });
      if (!pkg) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Package bulunamadı");
      }
      const oldState = {
        is_active: pkg.is_active,
      };
      const { is_active } = req.body;
      if (typeof is_active !== "boolean") {
        throw new AppError("VALIDATION_ERROR", 400, "is_active boolean olmalıdır");
      }
      pkg.is_active = is_active;

      const updatedPackage = await packageRepo.save(pkg);
      await AdminPackagesController.logPackageAudit(req, {
        eventType: "ADMIN_PACKAGE_STATUS_CHANGED",
        pkg: updatedPackage,
        oldState,
      });
      return res.json({ data: updatedPackage });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package status güncellenirken hata oluştu:", error);
      throw new AppError("ADMIN_PACKAGE_STATUS_UPDATE_ERROR", 500, "Admin package status güncellenirken sunucu hatası oluştu");
    }
  }

  // --- DELETE /api/admin/packages/:id ---
  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const packageId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const packageRepo = AppDataSource.getRepository(Package);
      const pkg = await packageRepo.findOne({
        where: { id: packageId, tenant_id: tenantId },
      });
      if (!pkg) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Package bulunamadı");
      }
      const oldState = {
        title: pkg.title,
        type: pkg.type,
        total_credits: pkg.total_credits,
        duration_days: pkg.duration_days,
        is_active: pkg.is_active,
      };

      pkg.is_active = false;
      pkg.is_visible = false;
      pkg.is_public = false;
      const updatedPackage = await packageRepo.save(pkg);
      await AdminPackagesController.logPackageAudit(req, {
        eventType: "ADMIN_PACKAGE_ARCHIVED",
        pkg: updatedPackage,
        oldState,
      });
      return res.json({ message: "Package arşivlendi", data: updatedPackage });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin package silinirken hata oluştu:", error);
      throw new AppError("ADMIN_PACKAGE_DELETE_ERROR", 500, "Admin package silinirken sunucu hatası oluştu");
    }
  }
}
