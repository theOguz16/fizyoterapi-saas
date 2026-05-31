// Bu controller admin tarafindaki trainers.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import crypto from "crypto";
import { LessonCategory } from "../../entities/class-session.entity";
import { TrainerSkill } from "../../entities/trainer-skill.entity";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { hashPassword } from "../../services/password.service";
import { IsNull } from "typeorm";
import { Attendance, AttendanceResult } from "../../entities/attendance.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { Package } from "../../entities/package.entity";
import { Account } from "../../entities/account.entity";
import { AuditLogService } from "../../services/audit-log.service";

export class AdminTrainersController {
  private static async logTrainerAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      trainer: User;
      oldState?: Record<string, unknown> | null;
      extra?: Record<string, unknown>;
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
      target_type: "trainer",
      target_id: input.trainer.id,
      metadata: {
        trainer_id: input.trainer.id,
        email: input.trainer.email,
        is_active: input.trainer.is_active,
        deleted_at: input.trainer.deleted_at?.toISOString() ?? null,
        old_state: input.oldState ?? null,
        ...(input.extra ?? {}),
      },
    });
  }

  private static toSafeUser(user: User) {
    const { password_hash: _password_hash, ...safeUser } = user;
    return safeUser;
  }

  // Şifre oluşturma
  private static generateRandomPassword(length: number = 12): string {
    const randomPassword = crypto.randomBytes(length).toString("base64").slice(0, length);
    return randomPassword;
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/trainers ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const trainers = await AppDataSource.getRepository(User).find({
        where: { tenant_id: tenantId, role: UserRole.TRAINER, deleted_at: IsNull() },
        order: { created_at: "DESC" },
      });
      return res.json({ data: trainers.map((trainer) => AdminTrainersController.toSafeUser(trainer)) });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer List Error:", error);
      throw new AppError("ADMIN_TRAINERS_LIST_ERROR", 500, "Admin trainer listesi getirilirken sunucu hatası oluştu");
    }  
  };
    

  static async create(req: AuthenticatedRequest, res: Response) {
    // --- POST /api/admin/trainers ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const { email, first_name, last_name, phone } = req.body;
      const normalizedEmail = String(email ?? "").trim().toLowerCase();
      const normalizedFirstName = String(first_name ?? "").trim();
      const normalizedLastName = String(last_name ?? "").trim();
      const normalizedPhone = String(phone ?? "").trim();
      
      if (!normalizedEmail || !normalizedFirstName || !normalizedLastName || !normalizedPhone) {
        throw new AppError("MISSING_FIELDS", 400, "Gerekli alanlar eksik: email, first_name, last_name, phone");
      }

      const existingUser = await AppDataSource.getRepository(User).findOne({ where: { tenant_id: tenantId, email: normalizedEmail } });
      if (existingUser) {
        throw new AppError("EMAIL_ALREADY_EXISTS", 400, "Bu email zaten kayıtlı");
      }

      const randomPassword = AdminTrainersController.generateRandomPassword();
      const passwordHash = await hashPassword(randomPassword);
      
      const trainer = new User();
      trainer.tenant_id = tenantId;
      trainer.email = normalizedEmail;
      trainer.first_name = normalizedFirstName;
      trainer.last_name = normalizedLastName;
      trainer.phone = normalizedPhone;
      trainer.role = UserRole.TRAINER;
      trainer.password_hash = passwordHash;
      
      await AppDataSource.getRepository(User).save(trainer);
      await AdminTrainersController.logTrainerAudit(req, {
        eventType: "ADMIN_TRAINER_CREATED",
        trainer,
      });

      return res.status(201).json({
        message: "Admin trainer başarıyla oluşturuldu",
        data: AdminTrainersController.toSafeUser(trainer),
        deprecation: {
          deprecated: true,
          message: "Bu endpoint davet tabanli akisa tasiniyor. Yeni akis: POST /api/admin/invites",
        },
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer Create Error:", error);
      throw new AppError("ADMIN_TRAINER_CREATE_ERROR", 500, "Admin trainer oluşturulurken sunucu hatası oluştu");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/trainers/:id ---
    try {
      const tenantId = req.tenantId;
      const trainerId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const trainer = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER, deleted_at: IsNull() },
        select: ["id", "email", "first_name", "last_name", "phone", "created_at", "is_active"]
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }
      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: { tenant_id: tenantId, user_id: trainer.id, role: UserRole.TRAINER },
        order: { created_at: "DESC" },
      });
      const account = membership?.account_id
        ? await AppDataSource.getRepository(Account).findOne({ where: { id: membership.account_id } })
        : null;
      return res.json({
        data: {
          ...AdminTrainersController.toSafeUser(trainer),
          onboarding_profile: account?.onboarding_profile || null,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer GetById Error:", error);
      throw new AppError("ADMIN_TRAINER_GETBYID_ERROR", 500, "Admin trainer get by id işlemi sırasında sunucu hatası oluştu");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    // --- PUT /api/admin/trainers/:id ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const trainerId = String(req.params.id ?? "");
      const { email, first_name, last_name, phone } = req.body;

      const trainerRepo = AppDataSource.getRepository(User);
      const trainer = await trainerRepo.findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER, deleted_at: IsNull() },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }

      if (email && String(email).trim().toLowerCase() !== trainer.email) {
        const existingUser = await trainerRepo.findOne({ where: { tenant_id: tenantId, email: String(email).trim().toLowerCase() } });
        if (existingUser) {
          throw new AppError("EMAIL_ALREADY_EXISTS", 400, "Bu email zaten kayıtlı");
        }
      }
      const oldState = {
        email: trainer.email,
        first_name: trainer.first_name,
        last_name: trainer.last_name,
        phone: trainer.phone,
      };

      if (email) trainer.email = String(email).trim().toLowerCase();
      if (first_name) trainer.first_name = String(first_name).trim();
      if (last_name) trainer.last_name = String(last_name).trim();
      if (phone) trainer.phone = String(phone).trim();

      await trainerRepo.save(trainer);
      await AdminTrainersController.logTrainerAudit(req, {
        eventType: "ADMIN_TRAINER_UPDATED",
        trainer,
        oldState,
      });
      return res.json({ data: AdminTrainersController.toSafeUser(trainer) });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer Update Error:", error);
      throw new AppError("ADMIN_TRAINER_UPDATE_ERROR", 500, "Admin trainer güncellenirken sunucu hatası oluştu");
    }
  }

  static async setStatus(req: AuthenticatedRequest, res: Response) {
    // --- PATCH /api/admin/trainers/:id/status ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const trainerId = String(req.params.id ?? "");
      const { is_active } = req.body;

      if (typeof is_active !== "boolean") {
        throw new AppError("INVALID_IS_ACTIVE", 400, "is_active alanı boolean olmalıdır.");
      }

      const trainerRepo = AppDataSource.getRepository(User);
      const membershipRepo = AppDataSource.getRepository(SalonMembership);
      const trainer = await trainerRepo.findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER, deleted_at: IsNull() },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }
      const oldState = {
        is_active: trainer.is_active,
      };

      trainer.is_active = is_active;

      const membership = await membershipRepo.findOne({
        where: { tenant_id: tenantId, user_id: trainerId, role: UserRole.TRAINER },
      });

      if (membership) {
        membership.status = is_active ? SalonMembershipStatus.ACTIVE : SalonMembershipStatus.LEFT;
        membership.is_active_context = is_active;
        membership.left_at = is_active ? null : new Date();
        membership.joined_at = is_active ? membership.joined_at || new Date() : membership.joined_at;
        await membershipRepo.save(membership);
      }
      
      await trainerRepo.save(trainer);
      await AdminTrainersController.logTrainerAudit(req, {
        eventType: "ADMIN_TRAINER_STATUS_CHANGED",
        trainer,
        oldState,
      });
      return res.json({ data: AdminTrainersController.toSafeUser(trainer) });
    } catch (error) {
      if (error instanceof AppError) {
        throw error; 
      }
      console.error("Admin Trainer SetStatus Error:", error);
      throw new AppError("ADMIN_TRAINER_SET_STATUS_ERROR", 500, "Admin trainer durumu güncellenirken sunucu hatası oluştu");
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    // --- DELETE /api/admin/trainers/:id ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const trainerId = String(req.params.id ?? "");

      const trainerRepo = AppDataSource.getRepository(User);
      const membershipRepo = AppDataSource.getRepository(SalonMembership);
      const trainer = await trainerRepo.findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER, deleted_at: IsNull() },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }
      const oldState = {
        is_active: trainer.is_active,
        deleted_at: trainer.deleted_at?.toISOString() ?? null,
      };

      trainer.is_active = false;
      trainer.deleted_at = new Date();

      const membership = await membershipRepo.findOne({
        where: { tenant_id: tenantId, user_id: trainerId, role: UserRole.TRAINER },
      });

      if (membership) {
        membership.status = SalonMembershipStatus.LEFT;
        membership.is_active_context = false;
        membership.left_at = new Date();
        await membershipRepo.save(membership);
      }

      await trainerRepo.save(trainer);
      await AdminTrainersController.logTrainerAudit(req, {
        eventType: "ADMIN_TRAINER_REMOVED",
        trainer,
        oldState,
      });
      return res.json({
        message: "Eğitmen klinikten çıkarıldı",
        data: AdminTrainersController.toSafeUser(trainer),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer Remove Error:", error);
      throw new AppError("ADMIN_TRAINER_REMOVE_ERROR", 500, "Admin trainer silinirken sunucu hatası oluştu");
    }
  }

  static async earningsSummary(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/trainers/:id/earnings ---
    try {
      const tenantId = req.tenantId;
      const trainerId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const trainer = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER, deleted_at: IsNull() },
        select: ["id"],
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }

      const raw = await AppDataSource.getRepository(Attendance)
        .createQueryBuilder("a")
        .leftJoin(UserPackage, "up", "up.id = a.user_package_id AND up.tenant_id = a.tenant_id")
        .leftJoin(Package, "p", "p.id = up.package_id AND p.tenant_id = a.tenant_id")
        .select(
          "COALESCE(SUM(CASE WHEN a.result = :creditResult AND a.created_at >= date_trunc('day', now()) THEN (a.credits_deducted * COALESCE(p.display_price::numeric, 0) * (CASE WHEN (p.rules->>'trainer_commission_rate') ~ '^[0-9]+(\\\\.[0-9]+)?$' THEN ((p.rules->>'trainer_commission_rate')::numeric / 100) ELSE 0.25 END)) ELSE 0 END), 0)",
          "daily_income"
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN a.result = :creditResult AND a.created_at >= date_trunc('week', now()) THEN (a.credits_deducted * COALESCE(p.display_price::numeric, 0) * (CASE WHEN (p.rules->>'trainer_commission_rate') ~ '^[0-9]+(\\\\.[0-9]+)?$' THEN ((p.rules->>'trainer_commission_rate')::numeric / 100) ELSE 0.25 END)) ELSE 0 END), 0)",
          "weekly_income"
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN a.result = :creditResult AND a.created_at >= date_trunc('month', now()) THEN (a.credits_deducted * COALESCE(p.display_price::numeric, 0) * (CASE WHEN (p.rules->>'trainer_commission_rate') ~ '^[0-9]+(\\\\.[0-9]+)?$' THEN ((p.rules->>'trainer_commission_rate')::numeric / 100) ELSE 0.25 END)) ELSE 0 END), 0)",
          "monthly_income"
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN a.result = :creditResult AND a.created_at >= date_trunc('year', now()) THEN (a.credits_deducted * COALESCE(p.display_price::numeric, 0) * (CASE WHEN (p.rules->>'trainer_commission_rate') ~ '^[0-9]+(\\\\.[0-9]+)?$' THEN ((p.rules->>'trainer_commission_rate')::numeric / 100) ELSE 0.25 END)) ELSE 0 END), 0)",
          "yearly_income"
        )
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.trainer_id = :trainerId", { trainerId })
        .setParameter("creditResult", AttendanceResult.CREDIT_DEDUCTED)
        .getRawOne<{
          daily_income: string;
          weekly_income: string;
          monthly_income: string;
          yearly_income: string;
        }>();

      const toNumber = (value?: string | null) => Number(value || 0);

      return res.json({
        data: {
          daily_income: toNumber(raw?.daily_income),
          weekly_income: toNumber(raw?.weekly_income),
          monthly_income: toNumber(raw?.monthly_income),
          yearly_income: toNumber(raw?.yearly_income),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Trainer Earnings Summary Error:", error);
      throw new AppError("ADMIN_TRAINER_EARNINGS_SUMMARY_ERROR", 500, "Eğitmen finans özeti getirilirken sunucu hatası oluştu");
    }
  }

  // --- GET /api/admin/trainers/:id/skills ---
  static async getSkills(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const trainer = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }

      const rows = await AppDataSource.getRepository(TrainerSkill).find({
        where: { tenant_id: tenantId, trainer_id: trainerId, is_active: true },
        order: { lesson_category: "ASC" },
      });

      return res.json({
        data: rows.map((row) => row.lesson_category),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin Trainer Skills Get Error:", error);
      throw new AppError("ADMIN_TRAINER_SKILLS_GET_ERROR", 500, "Trainer skill bilgisi getirilirken hata oluştu");
    }
  }

  // --- PUT /api/admin/trainers/:id/skills ---
  static async setSkills(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const trainer = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Admin trainer bulunamadı");
      }

      const categoriesRaw = Array.isArray(req.body?.lesson_categories) ? req.body.lesson_categories : null;
      if (!categoriesRaw) {
        throw new AppError("VALIDATION_ERROR", 400, "lesson_categories listesi zorunludur");
      }

      const categories: LessonCategory[] = Array.from(
        new Set(
          categoriesRaw.map((value: unknown) => String(value).toUpperCase() as LessonCategory)
        )
      );
      const validSet = new Set(Object.values(LessonCategory));
      const invalid = categories.find((value) => !validSet.has(value));
      if (invalid) {
        throw new AppError("VALIDATION_ERROR", 400, `Gecersiz lesson_category: ${invalid}`);
      }

      const repo = AppDataSource.getRepository(TrainerSkill);
      const existing = await repo.find({
        where: { tenant_id: tenantId, trainer_id: trainerId },
      });

      const byCategory = new Map(existing.map((row) => [row.lesson_category, row]));
      for (const category of categories) {
        const row = byCategory.get(category);
        if (row) {
          if (!row.is_active) {
            row.is_active = true;
            await repo.save(row);
          }
        } else {
          const created = repo.create({
            tenant_id: tenantId,
            trainer_id: trainerId,
            lesson_category: category,
            is_active: true,
          });
          await repo.save(created);
        }
      }

      for (const row of existing) {
        if (!categories.includes(row.lesson_category) && row.is_active) {
          row.is_active = false;
          await repo.save(row);
        }
      }

      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_TRAINER_SKILLS_UPDATED",
        action: "ADMIN_TRAINER_SKILLS_UPDATED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "trainer",
        target_id: trainerId,
        metadata: {
          trainer_id: trainerId,
          lesson_categories: categories,
        },
      });

      return res.json({ data: categories });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin Trainer Skills Set Error:", error);
      throw new AppError("ADMIN_TRAINER_SKILLS_SET_ERROR", 500, "Trainer skill kaydi sırasında sunucu hatası oluştu");
    }
  }
}
