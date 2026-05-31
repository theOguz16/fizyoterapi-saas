// Bu controller admin tarafindaki package trainers.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Package } from "../../entities/package.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { enrichPackageRowForDisplay, normalizeLessonCatalogServices } from "../../services/package.service";

export class AdminPackageTrainersController {
  private static async logAssignmentAudit(
    req: AuthenticatedRequest,
    input: { eventType: string; row: PackageTrainerAssignment; oldState?: Record<string, unknown> | null }
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
      target_type: "package_trainer_assignment",
      target_id: input.row.id,
      metadata: {
        package_id: input.row.package_id,
        trainer_id: input.row.trainer_id,
        is_active: input.row.is_active,
        old_state: input.oldState ?? null,
      },
    });
  }

  // --- GET /api/admin/package-trainers ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const packageId = req.query.package_id ? String(req.query.package_id) : undefined;
      const trainerId = req.query.trainer_id ? String(req.query.trainer_id) : undefined;
      const isActive = req.query.is_active === undefined ? undefined : String(req.query.is_active) === "true";

      const where: {
        tenant_id: string;
        package_id?: string;
        trainer_id?: string;
        is_active?: boolean;
      } = { tenant_id: tenantId };
      if (packageId) where.package_id = packageId;
      if (trainerId) where.trainer_id = trainerId;
      if (isActive !== undefined) where.is_active = isActive;

      const rows = await AppDataSource.getRepository(PackageTrainerAssignment).find({
        where,
        order: { created_at: "DESC" },
      });

      const packageIds = Array.from(new Set(rows.map((row) => row.package_id)));
      const trainerIds = Array.from(new Set(rows.map((row) => row.trainer_id)));

      const [packages, trainers] = await Promise.all([
        packageIds.length
          ? AppDataSource.getRepository(Package).find({
              where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
              select: ["id", "title", "type", "display_price", "is_active", "rules", "capacity"],
            })
          : Promise.resolve([]),
        trainerIds.length
          ? AppDataSource.getRepository(User).find({
              where: trainerIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.TRAINER })),
              select: ["id", "first_name", "last_name", "email", "is_active"],
            })
          : Promise.resolve([]),
      ]);

      const profile = await AppDataSource.getRepository(SalonProfile).findOne({
        where: { tenant_id: tenantId },
        order: { created_at: "DESC" },
      });
      const catalog = normalizeLessonCatalogServices(profile?.services);
      const packageMap = new Map(packages.map((row) => [row.id, enrichPackageRowForDisplay(row, catalog)]));
      const trainerMap = new Map(trainers.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => {
          const pkg = packageMap.get(row.package_id);
          const trainer = trainerMap.get(row.trainer_id);
          return {
            ...row,
            package_title: pkg?.title ?? null,
            package_type: pkg?.type ?? null,
            package_display_price: pkg?.display_price ?? null,
            package_service_name: pkg?.service_name ?? null,
            package_lesson_category: pkg?.lesson_category ?? null,
            package_capacity_label: pkg?.capacity_label ?? null,
            package_commission_label: pkg?.commission_label ?? null,
            package_is_active: pkg?.is_active ?? null,
            trainer_full_name: trainer ? `${trainer.first_name} ${trainer.last_name}`.trim() : null,
            trainer_email: trainer?.email ?? null,
            trainer_is_active: trainer?.is_active ?? null,
          };
        }),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin package-trainer list error:", error);
      throw new AppError("ADMIN_PACKAGE_TRAINER_LIST_ERROR", 500, "Paket-egitmen atamalari listelenemedi");
    }
  }

  // --- POST /api/admin/package-trainers ---
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const packageId = String(req.body?.package_id ?? "").trim();
      const trainerId = String(req.body?.trainer_id ?? "").trim();
      if (!packageId || !trainerId) {
        throw new AppError("VALIDATION_ERROR", 400, "package_id ve trainer_id zorunludur");
      }

      const [pkg, trainer] = await Promise.all([
        AppDataSource.getRepository(Package).findOne({ where: { tenant_id: tenantId, id: packageId } }),
        AppDataSource.getRepository(User).findOne({
          where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER },
        }),
      ]);

      if (!pkg) throw new AppError("PACKAGE_NOT_FOUND", 404, "Paket bulunamadi");
      if (!trainer) throw new AppError("TRAINER_NOT_FOUND", 404, "Egitmen bulunamadi");

      const repo = AppDataSource.getRepository(PackageTrainerAssignment);
      let row = await repo.findOne({
        where: { tenant_id: tenantId, package_id: packageId, trainer_id: trainerId },
      });

      if (row) {
        row.is_active = true;
      } else {
        row = repo.create({
          tenant_id: tenantId,
          package_id: packageId,
          trainer_id: trainerId,
          is_active: true,
        });
      }

      await repo.save(row);
      await AdminPackageTrainersController.logAssignmentAudit(req, {
        eventType: "ADMIN_PACKAGE_TRAINER_ASSIGNED",
        row,
      });
      return res.status(201).json({ data: row });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin package-trainer create error:", error);
      throw new AppError("ADMIN_PACKAGE_TRAINER_CREATE_ERROR", 500, "Paket-egitmen atamasi yapilamadi");
    }
  }

  // --- DELETE /api/admin/package-trainers/:id ---
  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const assignmentId = String(req.params.id ?? "").trim();
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      if (!assignmentId) throw new AppError("VALIDATION_ERROR", 400, "id zorunludur");

      const repo = AppDataSource.getRepository(PackageTrainerAssignment);
      const row = await repo.findOne({ where: { tenant_id: tenantId, id: assignmentId } });
      if (!row) {
        throw new AppError("ASSIGNMENT_NOT_FOUND", 404, "Atama bulunamadi");
      }

      const oldState = { is_active: row.is_active };
      row.is_active = false;
      await repo.save(row);
      await AdminPackageTrainersController.logAssignmentAudit(req, {
        eventType: "ADMIN_PACKAGE_TRAINER_UNASSIGNED",
        row,
        oldState,
      });
      return res.json({ message: "Paket-egitmen atamasi kaldirildi", data: row });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin package-trainer remove error:", error);
      throw new AppError("ADMIN_PACKAGE_TRAINER_REMOVE_ERROR", 500, "Paket-egitmen atamasi kaldirilamadi");
    }
  }
}
