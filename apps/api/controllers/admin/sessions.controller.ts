// Bu controller admin tarafindaki sessions.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { ClassSession, GroupClassNotificationScope, LessonCategory, SessionStatus, SessionType } from "../../entities/class-session.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { TrainerSkill } from "../../entities/trainer-skill.entity";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { UserRole } from "../../entities/user.entity";
import { AuditLogService } from "../../services/audit-log.service";
import { GroupClassService } from "../../services/group-class.service";

export class AdminSessionsController {
  private static async logSessionAudit(
    req: AuthenticatedRequest,
    input: { eventType: string; session: ClassSession; oldState?: Record<string, unknown> | null }
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
      target_type: "session",
      target_id: input.session.id,
      metadata: {
        session_id: input.session.id,
        trainer_id: input.session.trainer_id ?? null,
        related_package_id: input.session.related_package_id ?? null,
        status: input.session.status,
        lesson_category: input.session.lesson_category,
        old_state: input.oldState ?? null,
      },
    });
  }

  private static parseDate(value: unknown, field: string) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} gecersiz tarih`);
    }
    return date;
  }

  private static validateStatus(status: unknown): asserts status is SessionStatus {
    if (typeof status !== "string" || !Object.values(SessionStatus).includes(status as SessionStatus)) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz session status");
    }
  }

  private static validateType(type: unknown): asserts type is SessionType {
    if (typeof type !== "string" || !Object.values(SessionType).includes(type as SessionType)) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz session type");
    }
  }

  private static validateLessonCategory(lessonCategory: unknown): asserts lessonCategory is LessonCategory {
    if (
      typeof lessonCategory !== "string" ||
      !Object.values(LessonCategory).includes(lessonCategory as LessonCategory)
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz lesson_category");
    }
  }

  private static validateNotificationScope(scope: unknown): asserts scope is GroupClassNotificationScope {
    if (
      typeof scope !== "string" ||
      !Object.values(GroupClassNotificationScope).includes(scope as GroupClassNotificationScope)
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz bildirim kapsami");
    }
  }

  private static normalizeInvitedMemberIds(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
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

  private static async ensureTrainerSkill(
    tenantId: string,
    trainerId: string | undefined,
    lessonCategory: LessonCategory
  ) {
    if (!trainerId) return;
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

  private static async ensureTrainerPackageAssignment(
    tenantId: string,
    trainerId: string | undefined,
    packageId: string | undefined
  ) {
    if (!trainerId || !packageId) return;
    const assignment = await AppDataSource.getRepository(PackageTrainerAssignment).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        package_id: packageId,
        is_active: true,
      },
    });
    if (!assignment) {
      throw new AppError(
        "PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND",
        400,
        "Secilen egitmen bu paket icin yetkilendirilmemis"
      );
    }
  }

  private static async validateTrainerOverlap(
    tenantId: string,
    trainerId: string | undefined,
    startsAt: Date,
    endsAt: Date,
    excludeSessionId?: string
  ) {
    if (!trainerId) return;
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
      throw new AppError("TRAINER_OVERLAP", 400, "Bu egitmen icin seans saat cakismasi var");
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const status = req.query.status ? String(req.query.status) : undefined;
      const where: {
        tenant_id: string;
        status?: SessionStatus;
      } = { tenant_id: tenantId };
      if (status && Object.values(SessionStatus).includes(status as SessionStatus)) {
        where.status = status as SessionStatus;
      }

      const rows = await AppDataSource.getRepository(ClassSession).find({
        where,
        order: { starts_at: "ASC" },
      });
      return res.json({ data: await GroupClassService.attachCounts(tenantId, rows) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions list error:", error);
      throw new AppError("ADMIN_SESSIONS_LIST_ERROR", 500, "Seanslar listelenemedi");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const {
        type,
        title,
        starts_at,
        ends_at,
        trainer_id,
        related_package_id,
        capacity,
        lesson_category,
        price,
        notification_scope,
        requires_admin_approval,
        invited_member_count,
        recurrence_label,
        special_date,
        invited_member_ids,
      } = req.body ?? {};
      if (!type || !title || !starts_at || !ends_at) {
        throw new AppError("VALIDATION_ERROR", 400, "type, title, starts_at, ends_at zorunlu");
      }
      AdminSessionsController.validateType(type);

      const startsAt = AdminSessionsController.parseDate(starts_at, "starts_at");
      const endsAt = AdminSessionsController.parseDate(ends_at, "ends_at");
      if (endsAt <= startsAt) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalidir");
      }

      const capacityValue = Number(capacity ?? 0);
      if (!Number.isFinite(capacityValue) || capacityValue < 0) {
        throw new AppError("VALIDATION_ERROR", 400, "capacity gecersiz");
      }

      const trainerId = trainer_id ? String(trainer_id) : undefined;
      const lessonCategory =
        lesson_category !== undefined
          ? (lesson_category as LessonCategory)
          : type === SessionType.PT
          ? LessonCategory.PT
          : LessonCategory.GRUP;
      AdminSessionsController.validateLessonCategory(lessonCategory);
      const sessionNotificationScope =
        notification_scope !== undefined ? (notification_scope as GroupClassNotificationScope) : GroupClassNotificationScope.SALON_MEMBERS;
      AdminSessionsController.validateNotificationScope(sessionNotificationScope);
      await AdminSessionsController.validateTrainerOverlap(tenantId, trainerId, startsAt, endsAt);
      await AdminSessionsController.ensureTrainerSkill(tenantId, trainerId, lessonCategory);
      await AdminSessionsController.ensureTrainerPackageAssignment(
        tenantId,
        trainerId,
        related_package_id ? String(related_package_id) : undefined
      );
      const normalizedInvitedMemberIds = await AdminSessionsController.ensureInvitedMembers(
        tenantId,
        AdminSessionsController.normalizeInvitedMemberIds(invited_member_ids)
      );

      const session = AppDataSource.getRepository(ClassSession).create({
        tenant_id: tenantId,
        type,
        status: SessionStatus.SCHEDULED,
        title: String(title).trim(),
        starts_at: startsAt,
        ends_at: endsAt,
        trainer_id: trainerId,
        related_package_id: related_package_id ? String(related_package_id) : undefined,
        capacity: Math.floor(capacityValue),
        lesson_category: lessonCategory,
        price: price === undefined || price === null || price === "" ? null : String(Number(price).toFixed(2)),
        notification_scope: sessionNotificationScope,
        requires_admin_approval: requires_admin_approval === undefined ? true : Boolean(requires_admin_approval),
        invited_member_count: Math.max(0, Math.floor(Number(invited_member_count || 0))),
        recurrence_label: typeof recurrence_label === "string" && recurrence_label.trim() ? recurrence_label.trim() : null,
        special_date: typeof special_date === "string" && special_date.trim() ? special_date.trim() : null,
        meta: {
          invited_member_ids: normalizedInvitedMemberIds,
        },
      });
      await AppDataSource.getRepository(ClassSession).save(session);
      await GroupClassService.notifySessionPublished(session);
      await AdminSessionsController.logSessionAudit(req, { eventType: "ADMIN_SESSION_CREATED", session });
      return res.status(201).json({ data: GroupClassService.serialize(session) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions create error:", error);
      throw new AppError("ADMIN_SESSIONS_CREATE_ERROR", 500, "Seans olusturulamadi");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const sessionId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const session = await AppDataSource.getRepository(ClassSession).findOne({
        where: { id: sessionId, tenant_id: tenantId },
      });
      if (!session) {
        throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadi");
      }
      const [serialized] = await GroupClassService.attachCounts(tenantId, [session]);
      return res.json({ data: serialized });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions getById error:", error);
      throw new AppError("ADMIN_SESSIONS_GET_ERROR", 500, "Seans getirilemedi");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const sessionId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const repo = AppDataSource.getRepository(ClassSession);
      const session = await repo.findOne({ where: { id: sessionId, tenant_id: tenantId } });
      if (!session) {
        throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadi");
      }
      const oldState = {
        type: session.type,
        title: session.title,
        starts_at: session.starts_at.toISOString(),
        ends_at: session.ends_at.toISOString(),
        trainer_id: session.trainer_id ?? null,
        related_package_id: session.related_package_id ?? null,
        capacity: session.capacity,
        lesson_category: session.lesson_category,
      };

      const {
        type,
        title,
        starts_at,
        ends_at,
        trainer_id,
        related_package_id,
        capacity,
        lesson_category,
        price,
        notification_scope,
        requires_admin_approval,
        invited_member_count,
        recurrence_label,
        special_date,
        invited_member_ids,
      } = req.body ?? {};
      if (type !== undefined) {
        AdminSessionsController.validateType(type);
        session.type = type;
      }
      if (title !== undefined) session.title = String(title).trim();
      if (starts_at !== undefined) session.starts_at = AdminSessionsController.parseDate(starts_at, "starts_at");
      if (ends_at !== undefined) session.ends_at = AdminSessionsController.parseDate(ends_at, "ends_at");
      if (session.ends_at <= session.starts_at) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalidir");
      }
      if (trainer_id !== undefined) session.trainer_id = trainer_id ? String(trainer_id) : undefined;
      if (related_package_id !== undefined) session.related_package_id = related_package_id ? String(related_package_id) : undefined;
      if (capacity !== undefined) {
        const capacityValue = Number(capacity);
        if (!Number.isFinite(capacityValue) || capacityValue < 0) {
          throw new AppError("VALIDATION_ERROR", 400, "capacity gecersiz");
        }
        session.capacity = Math.floor(capacityValue);
      }
      if (lesson_category !== undefined) {
        AdminSessionsController.validateLessonCategory(lesson_category);
        session.lesson_category = lesson_category;
      }
      if (price !== undefined) {
        session.price = price === null || price === "" ? null : String(Number(price).toFixed(2));
      }
      if (notification_scope !== undefined) {
        AdminSessionsController.validateNotificationScope(notification_scope);
        session.notification_scope = notification_scope;
      }
      if (requires_admin_approval !== undefined) {
        session.requires_admin_approval = Boolean(requires_admin_approval);
      }
      if (invited_member_count !== undefined) {
        session.invited_member_count = Math.max(0, Math.floor(Number(invited_member_count || 0)));
      }
      if (recurrence_label !== undefined) {
        session.recurrence_label =
          typeof recurrence_label === "string" && recurrence_label.trim() ? recurrence_label.trim() : null;
      }
      if (special_date !== undefined) {
        session.special_date = typeof special_date === "string" && special_date.trim() ? special_date.trim() : null;
      }
      if (invited_member_ids !== undefined) {
        const normalizedInvitedMemberIds = await AdminSessionsController.ensureInvitedMembers(
          tenantId,
          AdminSessionsController.normalizeInvitedMemberIds(invited_member_ids)
        );
        session.meta = {
          ...(session.meta || {}),
          invited_member_ids: normalizedInvitedMemberIds,
        };
      }

      await AdminSessionsController.validateTrainerOverlap(
        tenantId,
        session.trainer_id,
        session.starts_at,
        session.ends_at,
        session.id
      );
      await AdminSessionsController.ensureTrainerSkill(tenantId, session.trainer_id, session.lesson_category);
      await AdminSessionsController.ensureTrainerPackageAssignment(
        tenantId,
        session.trainer_id,
        session.related_package_id
      );

      await repo.save(session);
      await GroupClassService.notifySessionPublished(session);
      await AdminSessionsController.logSessionAudit(req, { eventType: "ADMIN_SESSION_UPDATED", session, oldState });
      return res.json({ data: GroupClassService.serialize(session) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions update error:", error);
      throw new AppError("ADMIN_SESSIONS_UPDATE_ERROR", 500, "Seans guncellenemedi");
    }
  }

  static async setStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const sessionId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const status = req.body?.status;
      AdminSessionsController.validateStatus(status);

      const repo = AppDataSource.getRepository(ClassSession);
      const session = await repo.findOne({ where: { id: sessionId, tenant_id: tenantId } });
      if (!session) {
        throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadi");
      }
      const oldState = { status: session.status };
      session.status = status;
      await repo.save(session);
      await AdminSessionsController.logSessionAudit(req, { eventType: "ADMIN_SESSION_STATUS_CHANGED", session, oldState });
      return res.json({ data: session });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions setStatus error:", error);
      throw new AppError("ADMIN_SESSIONS_STATUS_ERROR", 500, "Seans durumu guncellenemedi");
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const sessionId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const repo = AppDataSource.getRepository(ClassSession);
      const session = await repo.findOne({ where: { id: sessionId, tenant_id: tenantId } });
      if (!session) {
        throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadi");
      }
      const oldState = { status: session.status };
      session.status = SessionStatus.CANCELED;
      await repo.save(session);
      await AdminSessionsController.logSessionAudit(req, { eventType: "ADMIN_SESSION_CANCELED", session, oldState });
      return res.json({ message: "Seans iptal edildi", data: session });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions remove error:", error);
      throw new AppError("ADMIN_SESSIONS_REMOVE_ERROR", 500, "Seans silinemedi");
    }
  }

  static async getAttendees(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const sessionId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const session = await AppDataSource.getRepository(ClassSession).findOne({
        where: { id: sessionId, tenant_id: tenantId },
      });
      if (!session) {
        throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadi");
      }

      const attendees = await AppDataSource.getRepository(Booking).find({
        where: { tenant_id: tenantId, session_id: sessionId, status: BookingStatus.APPROVED },
        order: { starts_at: "ASC" },
      });

      return res.json({
        data: attendees,
        capacity: session.capacity,
        approvedCount: attendees.length,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin sessions attendees error:", error);
      throw new AppError("ADMIN_SESSIONS_ATTENDEES_ERROR", 500, "Seans katilimcilari getirilemedi");
    }
  }
}
