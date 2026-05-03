import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { ClassSession, GroupClassNotificationScope, LessonCategory, SessionStatus, SessionType } from "../../entities/class-session.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { Package } from "../../entities/package.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { TrainerSkill } from "../../entities/trainer-skill.entity";
import { User, UserRole } from "../../entities/user.entity";
import { GroupClassService } from "../../services/group-class.service";
import { lessonCategoryLabel } from "../../services/presentation-label.service";
import { SlotValidationContractService } from "../../services/slot-validation-contract.service";

export class TrainerGroupClassesController {
  private static parseDate(value: unknown, field: string) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} gecersiz tarih`);
    }
    return date;
  }

  private static validateNotificationScope(scope: unknown): asserts scope is GroupClassNotificationScope {
    if (
      typeof scope !== "string" ||
      !Object.values(GroupClassNotificationScope).includes(scope as GroupClassNotificationScope)
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz bildirim kapsami");
    }
  }

  private static async ensurePackageAssignment(tenantId: string, trainerId: string, packageId?: string | null) {
    if (!packageId) return;
    const assignment = await AppDataSource.getRepository(PackageTrainerAssignment).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        package_id: packageId,
        is_active: true,
      },
    });
    if (!assignment) {
      throw new AppError("PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND", 400, "Bu paket egitmene atanmis degil");
    }
  }

  private static async loadBusinessHours(tenantId: string) {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "business_hours"],
    });
    return SlotValidationContractService.normalizeBusinessHours(profile?.business_hours);
  }

  private static normalizeInvitedMemberIds(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))
    );
  }

  private static async ensureInvitedMembers(tenantId: string, invitedMemberIds: string[]) {
    if (invitedMemberIds.length === 0) return [];

    const memberships = await AppDataSource.getRepository(SalonMembership).find({
      where: invitedMemberIds.map((userId) => ({
        tenant_id: tenantId,
        user_id: userId,
        role: UserRole.MEMBER,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      })) as any,
      select: ["user_id"],
    });

    const validIds = new Set(memberships.map((row) => String(row.user_id || "")).filter(Boolean));
    const missingIds = invitedMemberIds.filter((memberId) => !validIds.has(memberId));
    if (missingIds.length > 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Davet listesinde salonda aktif olmayan uye bulunuyor");
    }

    return invitedMemberIds;
  }

  static async formOptions(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = req.auth?.sub;
    if (!tenantId || !trainerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");

    const [businessHours, skills, assignments, memberships] = await Promise.all([
      TrainerGroupClassesController.loadBusinessHours(tenantId),
      AppDataSource.getRepository(TrainerSkill).find({
        where: { tenant_id: tenantId, trainer_id: trainerId, is_active: true },
        order: { lesson_category: "ASC" },
      }),
      AppDataSource.getRepository(PackageTrainerAssignment).find({
        where: { tenant_id: tenantId, trainer_id: trainerId, is_active: true },
        select: ["package_id"],
      }),
      AppDataSource.getRepository(SalonMembership).find({
        where: {
          tenant_id: tenantId,
          role: UserRole.MEMBER,
          status: SalonMembershipStatus.ACTIVE,
          is_active_context: true,
        },
        select: ["user_id"],
      }),
    ]);

    const skillSet = new Set(skills.map((row) => row.lesson_category));
    const packageIds = Array.from(new Set(assignments.map((row) => row.package_id).filter(Boolean)));
    const memberIds = Array.from(
      new Set(memberships.map((row) => String(row.user_id || "")).filter(Boolean))
    );

    const [packages, members] = await Promise.all([
      packageIds.length
        ? AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id, is_active: true })) as any,
            order: { title: "ASC" },
            select: ["id", "title", "display_price", "rules", "type", "capacity"],
          })
        : Promise.resolve([]),
      memberIds.length
        ? AppDataSource.getRepository(User).find({
            where: memberIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.MEMBER, is_active: true })) as any,
            order: { first_name: "ASC", last_name: "ASC" },
            select: ["id", "first_name", "last_name", "email", "phone"],
          })
        : Promise.resolve([]),
    ]);

    const resolvedPackages = packages
      .map((row) => {
        const rules =
          row.rules && typeof row.rules === "object" && !Array.isArray(row.rules)
            ? (row.rules as Record<string, unknown>)
            : {};
        const lessonCategory = String(rules.lesson_category ?? "").trim().toUpperCase() || null;
        const commissionRateValue = Number(rules.trainer_commission_rate);
        return {
          id: row.id,
          title: row.title,
          package_name: row.title,
          display_price: row.display_price ?? null,
          capacity: row.capacity ?? null,
          service_name: String(rules.service_name ?? "").trim() || row.title,
          lesson_category: lessonCategory,
          lesson_category_label: lessonCategoryLabel(lessonCategory),
          package_type: row.type,
          trainer_commission_rate: Number.isFinite(commissionRateValue) ? commissionRateValue : 25,
        };
      })
      .filter((row) => !row.lesson_category || skillSet.size === 0 || skillSet.has(row.lesson_category as LessonCategory));

    return res.json({
      data: {
        business_hours: businessHours,
        allowed_categories: skillSet.size > 0 ? Array.from(skillSet) : Object.values(LessonCategory),
        packages: resolvedPackages,
        members: members.map((row) => ({
          id: row.id,
          full_name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
          email: row.email,
          phone: row.phone,
        })),
      },
    });
  }

  private static async ensureSkill(tenantId: string, trainerId: string, lessonCategory: LessonCategory) {
    const skill = await AppDataSource.getRepository(TrainerSkill).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        lesson_category: lessonCategory,
        is_active: true,
      },
    });
    if (!skill) {
      throw new AppError("TRAINER_SKILL_MISMATCH", 400, "Egitmen bu ders kategorisi icin yetkili degil");
    }
  }

  private static async ensureOverlap(
    tenantId: string,
    trainerId: string,
    startsAt: Date,
    endsAt: Date,
    excludeSessionId?: string
  ) {
    const qb = AppDataSource.getRepository(ClassSession)
      .createQueryBuilder("s")
      .where("s.tenant_id = :tenantId", { tenantId })
      .andWhere("s.trainer_id = :trainerId", { trainerId })
      .andWhere("s.status != :canceled", { canceled: SessionStatus.CANCELED })
      .andWhere("s.starts_at < :endsAt", { endsAt })
      .andWhere("s.ends_at > :startsAt", { startsAt });

    if (excludeSessionId) {
      qb.andWhere("s.id != :excludeSessionId", { excludeSessionId });
    }

    const overlap = await qb.getOne();
    if (overlap) {
      throw new AppError("TRAINER_OVERLAP", 400, "Bu saat araliginda baska bir seans var");
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = req.auth?.sub;
    if (!tenantId || !trainerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");

    const rows = await AppDataSource.getRepository(ClassSession).find({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        type: SessionType.GROUP,
      },
      order: { starts_at: "ASC" },
    });

    return res.json({ data: await GroupClassService.attachCounts(tenantId, rows) });
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = req.auth?.sub;
    if (!tenantId || !trainerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");

    const {
      title,
      starts_at,
      ends_at,
      related_package_id,
      capacity,
      price,
      notification_scope,
      requires_admin_approval,
      invited_member_count,
      recurrence_label,
      special_date,
      invited_member_ids,
      lesson_category,
    } = req.body ?? {};

    if (!title || !starts_at || !ends_at) {
      throw new AppError("VALIDATION_ERROR", 400, "title, starts_at ve ends_at zorunlu");
    }

    const startsAt = TrainerGroupClassesController.parseDate(starts_at, "starts_at");
    const endsAt = TrainerGroupClassesController.parseDate(ends_at, "ends_at");
    if (endsAt <= startsAt) {
      throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalidir");
    }
    const lessonCategoryValue =
      typeof lesson_category === "string" && lesson_category.trim()
        ? (lesson_category as LessonCategory)
        : LessonCategory.GRUP;
    const normalizedInvitedMemberIds = await TrainerGroupClassesController.ensureInvitedMembers(
      tenantId,
      TrainerGroupClassesController.normalizeInvitedMemberIds(invited_member_ids)
    );
    const scopeValue =
      notification_scope !== undefined
        ? (notification_scope as GroupClassNotificationScope)
        : GroupClassNotificationScope.SALON_MEMBERS;
    TrainerGroupClassesController.validateNotificationScope(scopeValue);
    await TrainerGroupClassesController.ensureOverlap(tenantId, trainerId, startsAt, endsAt);
    await TrainerGroupClassesController.ensureSkill(tenantId, trainerId, lessonCategoryValue);
    const businessHours = await TrainerGroupClassesController.loadBusinessHours(tenantId);
    const businessHourResult = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, businessHours);
    if (!businessHourResult.ok) {
      throw new AppError("VALIDATION_ERROR", 400, businessHourResult.reason);
    }
    await TrainerGroupClassesController.ensurePackageAssignment(
      tenantId,
      trainerId,
      related_package_id ? String(related_package_id) : null
    );

    const repo = AppDataSource.getRepository(ClassSession);
    const session = repo.create({
      tenant_id: tenantId,
      trainer_id: trainerId,
      type: SessionType.GROUP,
      status: SessionStatus.PENDING,
      title: String(title).trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      related_package_id: related_package_id ? String(related_package_id) : undefined,
      capacity: Math.max(0, Math.floor(Number(capacity || 0))),
      lesson_category: lessonCategoryValue,
      price: price === undefined || price === null || price === "" ? null : String(Number(price).toFixed(2)),
      notification_scope: scopeValue,
      requires_admin_approval: true,
      invited_member_count: Math.max(0, Math.floor(Number(invited_member_count || 0))),
      recurrence_label: typeof recurrence_label === "string" && recurrence_label.trim() ? recurrence_label.trim() : null,
      special_date: typeof special_date === "string" && special_date.trim() ? special_date.trim() : null,
      meta: {
        invited_member_ids: normalizedInvitedMemberIds,
      },
    });

    await repo.save(session);
    await GroupClassService.notifySessionPublished(session);

    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const approvalEvent = eventRepo.create({
      tenant_id: tenantId,
      member_id: trainerId, // Talebi oluşturan eğitmen
      type: "MEMBER_CHANGE_REQUEST", // Mobil onaylarda bu tip kullanılıyor, grup dersleri için de aynı tip üzerinden ilerleyelim
      status: NotificationEventStatus.QUEUED,
      payload: {
        request_type: "GROUP_CLASS_CREATE",
        session_id: session.id,
        title: "Yeni Grup Dersi Onayı",
        subtitle: `${session.title} için eğitmen onayı bekleniyor.`,
        amount: price ? Number(price) : 0,
        is_group_class: true,
        lesson_name: session.title,
        special_date: session.special_date,
        recurrence_label: session.recurrence_label,
        notification_scope: session.notification_scope,
        note: "Eğitmen takvime yeni bir grup dersi eklemek istiyor.",
        submitted_at: new Date().toISOString(),
        status: "PENDING"
      }
    });
    await eventRepo.save(approvalEvent);

    return res.status(201).json({ data: GroupClassService.serialize(session) });
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = req.auth?.sub;
    const sessionId = String(req.params.id || "");
    if (!tenantId || !trainerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");

    const repo = AppDataSource.getRepository(ClassSession);
    const session = await repo.findOne({
      where: { id: sessionId, tenant_id: tenantId, trainer_id: trainerId, type: SessionType.GROUP },
    });
    if (!session) throw new AppError("SESSION_NOT_FOUND", 404, "Grup dersi bulunamadi");

    const {
      title,
      starts_at,
      ends_at,
      related_package_id,
      capacity,
      price,
      notification_scope,
      requires_admin_approval,
      invited_member_count,
      recurrence_label,
      special_date,
      invited_member_ids,
      lesson_category,
      status,
    } = req.body ?? {};

    if (title !== undefined) session.title = String(title).trim();
    if (starts_at !== undefined) session.starts_at = TrainerGroupClassesController.parseDate(starts_at, "starts_at");
    if (ends_at !== undefined) session.ends_at = TrainerGroupClassesController.parseDate(ends_at, "ends_at");
    if (session.ends_at <= session.starts_at) {
      throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalidir");
    }
    if (related_package_id !== undefined) session.related_package_id = related_package_id ? String(related_package_id) : undefined;
    if (capacity !== undefined) session.capacity = Math.max(0, Math.floor(Number(capacity || 0)));
    if (price !== undefined) session.price = price === null || price === "" ? null : String(Number(price).toFixed(2));
    if (notification_scope !== undefined) {
      TrainerGroupClassesController.validateNotificationScope(notification_scope);
      session.notification_scope = notification_scope;
    }
    session.requires_admin_approval = true;
    if (invited_member_count !== undefined) session.invited_member_count = Math.max(0, Math.floor(Number(invited_member_count || 0)));
    if (recurrence_label !== undefined) {
      session.recurrence_label = typeof recurrence_label === "string" && recurrence_label.trim() ? recurrence_label.trim() : null;
    }
    if (special_date !== undefined) {
      session.special_date = typeof special_date === "string" && special_date.trim() ? special_date.trim() : null;
    }
    if (lesson_category !== undefined) session.lesson_category = lesson_category;
    if (status !== undefined) session.status = status;
    if (invited_member_ids !== undefined) {
      const normalizedInvitedMemberIds = await TrainerGroupClassesController.ensureInvitedMembers(
        tenantId,
        TrainerGroupClassesController.normalizeInvitedMemberIds(invited_member_ids)
      );
      session.meta = {
        ...(session.meta || {}),
        invited_member_ids: normalizedInvitedMemberIds,
      };
    }

    await TrainerGroupClassesController.ensureOverlap(tenantId, trainerId, session.starts_at, session.ends_at, session.id);
    await TrainerGroupClassesController.ensureSkill(tenantId, trainerId, session.lesson_category);
    const businessHours = await TrainerGroupClassesController.loadBusinessHours(tenantId);
    const businessHourResult = SlotValidationContractService.isWithinBusinessHours(
      session.starts_at,
      session.ends_at,
      businessHours
    );
    if (!businessHourResult.ok) {
      throw new AppError("VALIDATION_ERROR", 400, businessHourResult.reason);
    }
    await TrainerGroupClassesController.ensurePackageAssignment(tenantId, trainerId, session.related_package_id);
    // Güncelleme işleminde status dışarıdan ne gelirse gelsin, admin onayı için PENDING'e zorluyoruz.
    session.status = SessionStatus.PENDING; 
    
    await repo.save(session);
    await GroupClassService.notifySessionPublished(session);

    // ADMİNE GÜNCELLEME İÇİN YENİ ONAY BİLDİRİMİ ATIYORUZ
    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const updateApprovalEvent = eventRepo.create({
      tenant_id: tenantId,
      member_id: trainerId, 
      type: "MEMBER_CHANGE_REQUEST", // Akışa uygun olması için CHANGE_REQUEST
      status: NotificationEventStatus.QUEUED,
      payload: {
        request_type: "GROUP_CLASS_UPDATE", // <-- BURASI YENİ
        session_id: session.id,
        title: "Grup Dersi Güncelleme Onayı",
        subtitle: `${session.title} dersi güncellendi, tekrar onay bekleniyor.`,
        amount: session.price ? Number(session.price) : 0,
        is_group_class: true,
        lesson_name: session.title,
        special_date: session.special_date,
        recurrence_label: session.recurrence_label,
        notification_scope: session.notification_scope,
        note: "Eğitmen mevcut bir grup dersinde değişiklik yaptı ve yeniden onaya sundu.",
        submitted_at: new Date().toISOString(),
        status: "PENDING"
      }
    });
    await eventRepo.save(updateApprovalEvent);

    return res.json({ data: GroupClassService.serialize(session) });

  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const trainerId = req.auth?.sub;
    const sessionId = String(req.params.id || "");
    if (!tenantId || !trainerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");

    const repo = AppDataSource.getRepository(ClassSession);
    const session = await repo.findOne({
      where: { id: sessionId, tenant_id: tenantId, trainer_id: trainerId, type: SessionType.GROUP },
    });
    if (!session) throw new AppError("SESSION_NOT_FOUND", 404, "Grup dersi bulunamadi");

    await repo.remove(session);
    return res.json({ message: "Grup dersi silindi" });
  }
}
