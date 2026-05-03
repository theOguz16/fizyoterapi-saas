// Bu controller admin tarafindaki members.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { User, UserRole} from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Package } from "../../entities/package.entity";
import { Attendance } from "../../entities/attendance.entity";
import { Measurement } from "../../entities/measurement.entity";
import { RetentionScore } from "../../entities/retention-score.entity";
import { Referral } from "../../entities/referral.entity";
import { SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import crypto from "crypto";
import { hashPassword } from "../../services/password.service";
import { IsNull } from "typeorm";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { Account } from "../../entities/account.entity";
import { AuditLogService } from "../../services/audit-log.service";

export class AdminMembersController {
  private static async logMemberAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      member: User;
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
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "member",
      target_id: input.member.id,
      metadata: {
        member_id: input.member.id,
        email: input.member.email,
        is_active: input.member.is_active,
        deleted_at: input.member.deleted_at?.toISOString() ?? null,
        old_state: input.oldState ?? null,
        ...(input.extra ?? {}),
      },
    });
  }

  private static toSafeUser(user: User) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // Şifre oluşturma
  private static generateRandomPassword(length: number = 12): string {
      let randomPassword = crypto.randomBytes(length).toString("base64").slice(0, length);
      return randomPassword;
    }
  // CRUD
  static async list(req: AuthenticatedRequest, res: Response) {
    // --- GET api/admin/members ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const members = await AppDataSource.getRepository(User).find({
        where: {tenant_id: tenantId, role: UserRole.MEMBER, deleted_at: IsNull()},
        order: ({created_at: "DESC"})
      })

      return res.json({data: members.map((member) => AdminMembersController.toSafeUser(member))});

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin members list error",error);
      throw new AppError("Admin member list error",500,"admin member list getilirken hata oluştu");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    // --- POST api/admin/members ---
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

      const randomPassword = AdminMembersController.generateRandomPassword();
      const passwordHash = await hashPassword(randomPassword);
            
      const member = new User();
      member.tenant_id = tenantId;
      member.email = normalizedEmail;
      member.first_name = normalizedFirstName;
      member.last_name = normalizedLastName;
      member.phone = normalizedPhone;
      member.role = UserRole.MEMBER;
      member.password_hash = passwordHash;

      await AppDataSource.getRepository(User).save(member);
      await AdminMembersController.logMemberAudit(req, {
        eventType: "ADMIN_MEMBER_CREATED",
        member,
      });

      return res.status(201).json({
        message: "Admin member başarıyla oluşturuldu",
        data: AdminMembersController.toSafeUser(member),
        deprecation: {
          deprecated: true,
          message: "Bu endpoint davet tabanli akisa tasiniyor. Yeni akis: POST /api/admin/invites",
        },
      });


    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin members create error",error);
      throw new AppError("Admin member creat error",500,"admin member create hatası");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/members/:id ---
    try {
      const tenantId = req.tenantId;
      const membersId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const member = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: membersId, role: UserRole.MEMBER, deleted_at: IsNull() },
        select: ["id", "email", "first_name", "last_name", "phone", "created_at", "is_active"]
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }
      const oldState = {
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
      };
      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: { tenant_id: tenantId, user_id: member.id, role: UserRole.MEMBER },
        order: { created_at: "DESC" },
      });
      const account = membership?.account_id
        ? await AppDataSource.getRepository(Account).findOne({ where: { id: membership.account_id } })
        : null;
      return res.json({
        data: {
          ...AdminMembersController.toSafeUser(member),
          onboarding_profile: account?.onboarding_profile || null,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin member GetById Error:", error);
      throw new AppError("ADMIN_MEMBER_GETBYID_ERROR", 500, "Admin member get by id işlemi sırasında sunucu hatası oluştu");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    // --- PUT /api/admin/members/:id ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const memberId = String(req.params.id ?? "");
      const { email, first_name, last_name, phone } = req.body;

      const memberRepo = AppDataSource.getRepository(User);
      const member = await memberRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER, deleted_at: IsNull() },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }

      if (email && String(email).trim().toLowerCase() !== member.email) {
        const existingUser = await memberRepo.findOne({ where: { tenant_id: tenantId, email: String(email).trim().toLowerCase() } });
        if (existingUser) {
          throw new AppError("EMAIL_ALREADY_EXISTS", 400, "Bu email zaten kayıtlı");
        }
      }
      const oldState = {
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
      };

      if (email) member.email = String(email).trim().toLowerCase();
      if (first_name) member.first_name = String(first_name).trim();
      if (last_name) member.last_name = String(last_name).trim();
      if (phone) member.phone = String(phone).trim();

      await memberRepo.save(member);
      await AdminMembersController.logMemberAudit(req, {
        eventType: "ADMIN_MEMBER_UPDATED",
        member,
        oldState,
      });
      return res.json({ data: AdminMembersController.toSafeUser(member) });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Member Update Error:", error);
      throw new AppError("ADMIN_MEMBER_UPDATE_ERROR", 500, "Admin member güncellenirken sunucu hatası oluştu");
    }
  }

  static async setStatus(req: AuthenticatedRequest, res: Response) {
    // --- PATCH /api/admin/members/:id/status ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const memberId = String(req.params.id ?? "");
      const { is_active } = req.body;

      if (typeof is_active !== "boolean") {
        throw new AppError("INVALID_IS_ACTIVE", 400, "is_active alanı boolean olmalıdır.");
      }

      const memberRepo = AppDataSource.getRepository(User);
      const membershipRepo = AppDataSource.getRepository(SalonMembership);
      const member = await memberRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER, deleted_at: IsNull() },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }
      const oldState = {
        is_active: member.is_active,
      };

      member.is_active = is_active;

      const membership = await membershipRepo.findOne({
        where: { tenant_id: tenantId, user_id: memberId, role: UserRole.MEMBER },
      });

      if (membership) {
        membership.status = is_active ? SalonMembershipStatus.ACTIVE : SalonMembershipStatus.LEFT;
        membership.is_active_context = is_active;
        membership.left_at = is_active ? null : new Date();
        membership.joined_at = is_active ? membership.joined_at || new Date() : membership.joined_at;
        await membershipRepo.save(membership);
      }
      
      await memberRepo.save(member);
      await AdminMembersController.logMemberAudit(req, {
        eventType: "ADMIN_MEMBER_STATUS_CHANGED",
        member,
        oldState,
      });
      return res.json({ data: AdminMembersController.toSafeUser(member) });
    } catch (error) {
      if (error instanceof AppError) {
        throw error; 
      }
      console.error("Admin Member SetStatus Error:", error);
      throw new AppError("ADMIN_MEMBER_SET_STATUS_ERROR", 500, "Admin member durumu güncellenirken sunucu hatası oluştu");
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    // --- DELETE /api/admin/members/:id ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const memberId = String(req.params.id ?? "");

      const memberRepo = AppDataSource.getRepository(User);
      const membershipRepo = AppDataSource.getRepository(SalonMembership);
      const member = await memberRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER, deleted_at: IsNull() },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }
      const oldState = {
        is_active: member.is_active,
        deleted_at: member.deleted_at?.toISOString() ?? null,
      };

      member.is_active = false;
      member.deleted_at = new Date();

      const membership = await membershipRepo.findOne({
        where: { tenant_id: tenantId, user_id: memberId, role: UserRole.MEMBER },
      });

      if (membership) {
        membership.status = SalonMembershipStatus.LEFT;
        membership.is_active_context = false;
        membership.left_at = new Date();
        await membershipRepo.save(membership);
      }

      await memberRepo.save(member);
      await AdminMembersController.logMemberAudit(req, {
        eventType: "ADMIN_MEMBER_REMOVED",
        member,
        oldState,
      });
      return res.json({
        message: "Üye salondan çıkarıldı",
        data: AdminMembersController.toSafeUser(member),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Member Remove Error:", error);
      throw new AppError("ADMIN_MEMBER_REMOVE_ERROR", 500, "Admin member silinirken sunucu hatası oluştu");
    }
  }

  // Paket atama / hak
  static async assignPackageToMember(req: AuthenticatedRequest, res: Response) {
    // --- POST /api/admin/members/:id/package ---
      try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const memberId = String(req.params.memberId ?? req.params.id ?? "");
      const { package_id, starts_at, expires_at } = req.body ?? {};

      if (!memberId || !package_id) {
        throw new AppError("VALIDATION_ERROR", 400, "memberId ve package_id zorunludur");
      }

      const packageRepo = AppDataSource.getRepository(Package);
      const userPackageRepo = AppDataSource.getRepository(UserPackage);
      const memberRepo = AppDataSource.getRepository(User);

      const member = await memberRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }

      const pkg = await packageRepo.findOne({
      where: { tenant_id: tenantId, id: String(package_id), is_active: true },
      });
      if (!pkg) throw new AppError("PACKAGE_NOT_FOUND", 404, "Paket bulunamadı");

      const startsAt = starts_at ? new Date(starts_at) : new Date();
      if (Number.isNaN(startsAt.getTime())) {
        throw new AppError("VALIDATION_ERROR", 400, "starts_at geçersiz");
      }

      let expiresAt: Date | null = null;
      if (expires_at !== undefined && expires_at !== null) {
        expiresAt = new Date(expires_at);
        if (Number.isNaN(expiresAt.getTime())) {
          throw new AppError("VALIDATION_ERROR", 400, "expires_at geçersiz");
        }
      } else if (pkg.duration_days > 0) {
        expiresAt = new Date(startsAt);
        expiresAt.setDate(expiresAt.getDate() + pkg.duration_days);
      }

        const userPackage = userPackageRepo.create({
        tenant_id: tenantId,
        user_id: memberId,
        package_id: pkg.id,
        remaining_credits: pkg.total_credits,
        starts_at: startsAt,
        expires_at: expiresAt ?? undefined,
        is_active: true,
      });

      await userPackageRepo.save(userPackage);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MEMBER_PACKAGE_ASSIGNED",
        action: "ADMIN_MEMBER_PACKAGE_ASSIGNED",
        method: req.method,
        path: req.originalUrl,
        status_code: 201,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "user_package",
        target_id: userPackage.id,
        metadata: {
          member_id: member.id,
          package_id: pkg.id,
          remaining_credits: userPackage.remaining_credits,
        },
      });

      return res.status(201).json({ data: userPackage });

      } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin Add Package Error:", error);
      throw new AppError("ADMIN_MEMBER_PACKAGE_ADD_ERROR", 500, "Admin package eklerken sunucu hatası oluştu");
    }  
  }

  static async listMemberPackages(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/members/:id/package ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");

      const memberId = String(req.params.memberId ?? req.params.id ?? "");
      if (!memberId) throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");

      const userPackageRepo = AppDataSource.getRepository(UserPackage);
      const memberRepo = AppDataSource.getRepository(User);

      const member = await memberRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Admin member bulunamadı");
      }

      const rows = await userPackageRepo.find({
      where: { tenant_id: tenantId, user_id: memberId },
      order: { created_at: "DESC" },
      });

      const packageIds = Array.from(new Set(rows.map((row) => row.package_id).filter(Boolean)));
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
          })
        : [];
      const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));

      const assignments = packageIds.length
        ? await AppDataSource.getRepository(PackageTrainerAssignment).find({
            where: packageIds.map((packageId) => ({ tenant_id: tenantId, package_id: packageId, is_active: true })),
          })
        : [];
      const trainerIds = Array.from(new Set(assignments.map((row) => row.trainer_id).filter(Boolean)));
      const trainers = trainerIds.length
        ? await AppDataSource.getRepository(User).find({
            where: trainerIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.TRAINER })),
            select: ["id", "first_name", "last_name", "email"],
          })
        : [];
      const trainerMap = new Map(
        trainers.map((trainer) => [
          trainer.id,
          {
            id: trainer.id,
            full_name: `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email,
            email: trainer.email,
          },
        ])
      );
      const assignmentsByPackage = new Map<string, Array<{ id: string; full_name: string; email: string }>>();
      for (const assignment of assignments) {
        const trainer = trainerMap.get(assignment.trainer_id);
        if (!trainer) continue;
        assignmentsByPackage.set(assignment.package_id, [...(assignmentsByPackage.get(assignment.package_id) || []), trainer]);
      }

      const now = new Date();
      const data = rows.map((row) => {
      const isExpired = !!row.expires_at && row.expires_at <= now;
      const pkg = packageMap.get(row.package_id);
      const assignedTrainers = assignmentsByPackage.get(row.package_id) || [];
      return {
        ...row,
        is_expired: isExpired,
        package_title: pkg?.title ?? null,
        package_type: pkg?.type ?? null,
        package_total_credits: pkg?.total_credits ?? null,
        package_duration_days: pkg?.duration_days ?? null,
        package_price: pkg?.display_price ? Number(pkg.display_price) : null,
        assigned_trainers: assignedTrainers,
        trainer_summary: assignedTrainers.length ? assignedTrainers.map((trainer) => trainer.full_name).join(", ") : null,
      };
      });

      const totalRemainingCredits = data
        .filter((r) => r.is_active && !r.is_expired)
        .reduce((acc, r) => acc + r.remaining_credits, 0);

      return res.json({ data, totalRemainingCredits });


    } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Admin list member packages error:", error);
    throw new AppError("ADMIN_MEMBER_PACKAGES_LIST_ERROR", 500, "Üye paketleri listelenirken hata oluştu");
  }

  }

  static async adjustCredits(req: AuthenticatedRequest, res: Response) {
    // --- PATCH /api/admin/members/user-packages/:userPackageId/credits ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");

      const userPackageId = String(req.params.userPackageId ?? req.params.id ?? "");
      const { remaining_credits } = req.body ?? {};

      const credits = Number(remaining_credits);
      if (!Number.isFinite(credits) || credits < 0) {
        throw new AppError("VALIDATION_ERROR", 400, "remaining_credits geçersiz");
      }

      const repo = AppDataSource.getRepository(UserPackage);
      const row = await repo.findOne({ where: { tenant_id: tenantId, id: userPackageId } });
      if (!row) throw new AppError("USER_PACKAGE_NOT_FOUND", 404, "User package bulunamadı");
      const oldState = { remaining_credits: row.remaining_credits };

      row.remaining_credits = credits;
      await repo.save(row);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MEMBER_CREDITS_ADJUSTED",
        action: "ADMIN_MEMBER_CREDITS_ADJUSTED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "user_package",
        target_id: row.id,
        metadata: {
          member_id: row.user_id,
          old_state: oldState,
          remaining_credits: row.remaining_credits,
        },
      });

      return res.json({ data: row });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin adjust credits error:", error);
      throw new AppError("ADMIN_MEMBER_CREDITS_ADJUST_ERROR", 500, "Kredi güncellenirken hata oluştu");
    }
  }

  static async removeUserPackage(req: AuthenticatedRequest, res: Response) {
    // --- DELETE /api/admin/members/user-packages/:userPackageId ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");

      const userPackageId = String(req.params.userPackageId ?? req.params.id ?? "");
      const repo = AppDataSource.getRepository(UserPackage);

      const row = await repo.findOne({ where: { tenant_id: tenantId, id: userPackageId } });
      if (!row) throw new AppError("USER_PACKAGE_NOT_FOUND", 404, "User package bulunamadı");
      const oldState = { is_active: row.is_active };

      row.is_active = false;
      await repo.save(row);
      await AuditLogService.log({
        tenant_id: tenantId,
        actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
        actor_account_id: req.auth?.accountId || null,
        actor_role: req.auth?.role || null,
        event_type: "ADMIN_MEMBER_PACKAGE_DEACTIVATED",
        action: "ADMIN_MEMBER_PACKAGE_DEACTIVATED",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: req.requestId || null,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "user_package",
        target_id: row.id,
        metadata: {
          member_id: row.user_id,
          old_state: oldState,
          is_active: row.is_active,
        },
      });

      return res.json({ message: "User package donduruldu", data: row });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin remove user package error:", error);
      throw new AppError("ADMIN_MEMBER_PACKAGE_REMOVE_ERROR", 500, "User package kaldırılırken hata oluştu");
    }
  }


  // Üye detay modülleri
  static async getAttendanceHistory(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/members/:memberId/attendance ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const memberId = String(req.params.memberId ?? req.params.id ?? "");
      if (!memberId) {
        throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
      }

      const member = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
      }

      const rows = await AppDataSource.getRepository(Attendance).find({
        where: { tenant_id: tenantId, member_id: memberId },
        order: { created_at: "DESC" },
      });

      return res.json({ data: rows });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin member attendance history error:", error);
      throw new AppError("ADMIN_MEMBER_ATTENDANCE_HISTORY_ERROR", 500, "Katılım geçmişi getirilirken hata oluştu");
    }
  }

static async getMeasurements(req: AuthenticatedRequest, res: Response) {
  // --- GET /api/admin/members/:memberId/measurements ---
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    const memberId = String(req.params.memberId ?? req.params.id ?? "");
    if (!memberId) {
      throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
    }

    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) {
      throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
    }

    const rows = await AppDataSource.getRepository(Measurement).find({
      where: { tenant_id: tenantId, member_id: memberId },
      order: { measured_at: "DESC" },
    });

    return res.json({ data: rows });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Admin member measurements error:", error);
    throw new AppError("ADMIN_MEMBER_MEASUREMENTS_ERROR", 500, "Ölçüm geçmişi getirilirken hata oluştu");
  }
}

static async getRetentionScore(req: AuthenticatedRequest, res: Response) {
  // --- GET /api/admin/members/:memberId/retention-score ---
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    const memberId = String(req.params.memberId ?? req.params.id ?? "");
    if (!memberId) {
      throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
    }

    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) {
      throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
    }

    const score = await AppDataSource.getRepository(RetentionScore).findOne({
      where: { tenant_id: tenantId, member_id: memberId },
      order: { calculated_at: "DESC" },
    });

    return res.json({ data: score ?? null });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Admin member retention score error:", error);
    throw new AppError("ADMIN_MEMBER_RETENTION_SCORE_ERROR", 500, "Sadakat skoru getirilirken hata oluştu");
  }
}

static async getReferrals(req: AuthenticatedRequest, res: Response) {
  // --- GET /api/admin/members/:memberId/referrals ---
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    const memberId = String(req.params.memberId ?? req.params.id ?? "");
    if (!memberId) {
      throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
    }

    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) {
      throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
    }

    const rows = await AppDataSource.getRepository(Referral).find({
      where: { tenant_id: tenantId, inviter_member_id: memberId },
      order: { created_at: "DESC" },
    });

    return res.json({ data: rows });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Admin member referrals error:", error);
    throw new AppError("ADMIN_MEMBER_REFERRALS_ERROR", 500, "Referanslar getirilirken hata oluştu");
  }
}
}
