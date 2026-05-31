// Bu controller admin tarafindaki measurements.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Measurement } from "../../entities/measurement.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AuditLogService } from "../../services/audit-log.service";

type ParsedAdminMeasurementPayload = {
  member_id: string;
  trainer_id: string;
  measured_at: Date;
  height_cm?: string;
  weight_kg?: string;
  fat_percent?: string;
  muscle_kg?: string;
  extras: Record<string, unknown>;
};

export class AdminMeasurementsController {
  private static async logMeasurementAudit(
    req: AuthenticatedRequest,
    input: { eventType: string; measurement: Measurement; oldState?: Record<string, unknown> | null }
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
      target_type: "measurement",
      target_id: input.measurement.id,
      metadata: {
        measurement_id: input.measurement.id,
        member_id: input.measurement.member_id,
        trainer_id: input.measurement.trainer_id,
        old_state: input.oldState ?? null,
      },
    });
  }

  private static parseDate(value: unknown, field: string): Date {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} gecersiz tarih`);
    }
    return date;
  }

  private static parseOptionalNumeric(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || String(value).trim() === "") {
      return undefined;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} gecersiz sayi`);
    }
    return n.toFixed(2);
  }

  private static toDto(row: Measurement) {
    return {
      id: row.id,
      member_id: row.member_id,
      trainer_id: row.trainer_id,
      measured_at: row.measured_at,
      height_cm: row.height_cm ?? null,
      weight_kg: row.weight_kg ?? null,
      fat_percent: row.fat_percent ?? null,
      muscle_kg: row.muscle_kg ?? null,
      extras: row.extras ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private static async ensureUser(tenantId: string, userId: string, role: UserRole) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: userId, role },
    });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", 404, `${role} bulunamadi`);
    }
    if (!user.is_active) {
      throw new AppError("USER_INACTIVE", 400, `${role} aktif degil`);
    }
    return user;
  }

  private static parsePayload(req: AuthenticatedRequest): ParsedAdminMeasurementPayload {
    const memberId = String(req.body?.member_id ?? "").trim();
    const trainerId = String(req.body?.trainer_id ?? "").trim();
    if (!memberId || !trainerId) {
      throw new AppError("VALIDATION_ERROR", 400, "member_id ve trainer_id zorunlu");
    }
    return {
      member_id: memberId,
      trainer_id: trainerId,
      measured_at: req.body?.measured_at
        ? AdminMeasurementsController.parseDate(req.body.measured_at, "measured_at")
        : new Date(),
      height_cm: AdminMeasurementsController.parseOptionalNumeric(req.body?.height_cm, "height_cm"),
      weight_kg: AdminMeasurementsController.parseOptionalNumeric(req.body?.weight_kg, "weight_kg"),
      fat_percent: AdminMeasurementsController.parseOptionalNumeric(req.body?.fat_percent, "fat_percent"),
      muscle_kg: AdminMeasurementsController.parseOptionalNumeric(req.body?.muscle_kg, "muscle_kg"),
      extras:
        req.body?.extras && typeof req.body.extras === "object" && !Array.isArray(req.body.extras)
          ? req.body.extras
          : {},
    };
  }

  private static async buildDueList(tenantId: string, thresholdDays: number) {
    const members = await AppDataSource.getRepository(User).find({
      where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true },
      order: { created_at: "DESC" },
    });
    if (members.length === 0) return [];

    const latestMeasurements = await AppDataSource.getRepository(Measurement)
      .createQueryBuilder("m")
      .distinctOn(["m.member_id"])
      .where("m.tenant_id = :tenantId", { tenantId })
      .andWhere("m.deleted_at IS NULL")
      .orderBy("m.member_id", "ASC")
      .addOrderBy("m.measured_at", "DESC")
      .getMany();
    const latestByMember = new Map(latestMeasurements.map((row) => [row.member_id, row]));

    const nowMs = Date.now();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    return members
      .map((member) => {
        const latest = latestByMember.get(member.id);
        if (!latest) {
          return {
            member_id: member.id,
            full_name: `${member.first_name} ${member.last_name}`.trim(),
            email: member.email,
            phone: member.phone,
            last_measured_at: null as string | null,
            days_since_last: null as number | null,
            due: true,
          };
        }
        const days = Math.floor((nowMs - new Date(latest.measured_at).getTime()) / (24 * 60 * 60 * 1000));
        return {
          member_id: member.id,
          full_name: `${member.first_name} ${member.last_name}`.trim(),
          email: member.email,
          phone: member.phone,
          last_measured_at: latest.measured_at,
          days_since_last: days,
          due: nowMs - new Date(latest.measured_at).getTime() >= thresholdMs,
        };
      })
      .filter((row) => row.due)
      .sort((a, b) => {
        const aDays = a.days_since_last ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.days_since_last ?? Number.MAX_SAFE_INTEGER;
        return bDays - aDays;
      });
  }

  // --- GET /api/admin/measurements?memberId=...
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const memberId = req.query.memberId ? String(req.query.memberId).trim() : "";
      const qb = AppDataSource.getRepository(Measurement)
        .createQueryBuilder("m")
        .where("m.tenant_id = :tenantId", { tenantId })
        .andWhere("m.deleted_at IS NULL")
        .orderBy("m.measured_at", "DESC");

      if (memberId) {
        qb.andWhere("m.member_id = :memberId", { memberId });
      }

      const rows = await qb.getMany();
      return res.json({ data: rows.map((row) => AdminMeasurementsController.toDto(row)) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements list error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_LIST_ERROR", 500, "Olcumler listelenemedi");
    }
  }

  // --- GET /api/admin/measurements/trend?memberId=...
  static async trend(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const memberId = String(req.query.memberId ?? "").trim();
      if (!memberId) {
        throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
      }

      const rows = await AppDataSource.getRepository(Measurement).find({
        where: { tenant_id: tenantId, member_id: memberId, deleted_at: IsNull() },
        order: { measured_at: "ASC" },
      });

      return res.json({
        data: {
          labels: rows.map((r) => r.measured_at),
          weight_kg: rows.map((r) => (r.weight_kg ? Number(r.weight_kg) : null)),
          fat_percent: rows.map((r) => (r.fat_percent ? Number(r.fat_percent) : null)),
          muscle_kg: rows.map((r) => (r.muscle_kg ? Number(r.muscle_kg) : null)),
          height_cm: rows.map((r) => (r.height_cm ? Number(r.height_cm) : null)),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements trend error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_TREND_ERROR", 500, "Olcum trendi getirilemedi");
    }
  }

  // --- GET /api/admin/measurements/due?thresholdDays=30
  static async dueList(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const thresholdRaw = req.query.thresholdDays ? Number(req.query.thresholdDays) : 30;
      const thresholdDays = Number.isFinite(thresholdRaw) ? Math.min(Math.max(thresholdRaw, 1), 365) : 30;

      const due = await AdminMeasurementsController.buildDueList(tenantId, thresholdDays);
      return res.json({ data: due, thresholdDays });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements dueList error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_DUE_ERROR", 500, "Geciken olcum listesi getirilemedi");
    }
  }

  // --- POST /api/admin/measurements/due/reminder-mock
  static async sendDueRemindersMock(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const thresholdRaw = req.body?.thresholdDays ? Number(req.body.thresholdDays) : 30;
      const thresholdDays = Number.isFinite(thresholdRaw) ? Math.min(Math.max(thresholdRaw, 1), 365) : 30;
      const due = await AdminMeasurementsController.buildDueList(tenantId, thresholdDays);

      return res.json({
        data: {
          thresholdDays,
          totalRecipients: due.length,
          preview: due.slice(0, 10).map((row) => ({
            member_id: row.member_id,
            email: row.email,
            phone: row.phone,
            message: "Aylik olcum zamani geldi. Lutfen egitmeninizle olcum randevunuzu olusturun.",
          })),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements reminder mock error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_REMINDER_MOCK_ERROR", 500, "Reminder mock calistirilamadi");
    }
  }

  // --- POST /api/admin/measurements
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const payload = AdminMeasurementsController.parsePayload(req);
      await AdminMeasurementsController.ensureUser(tenantId, payload.member_id, UserRole.MEMBER);
      await AdminMeasurementsController.ensureUser(tenantId, payload.trainer_id, UserRole.TRAINER);

      const measurement = AppDataSource.getRepository(Measurement).create({
        tenant_id: tenantId,
        member_id: payload.member_id,
        trainer_id: payload.trainer_id,
        measured_at: payload.measured_at,
        height_cm: payload.height_cm,
        weight_kg: payload.weight_kg,
        fat_percent: payload.fat_percent,
        muscle_kg: payload.muscle_kg,
        extras: payload.extras,
      });
      await AppDataSource.getRepository(Measurement).save(measurement);
      await AdminMeasurementsController.logMeasurementAudit(req, {
        eventType: "ADMIN_MEASUREMENT_CREATED",
        measurement,
      });
      return res.status(201).json({ data: AdminMeasurementsController.toDto(measurement) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements create error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_CREATE_ERROR", 500, "Olcum olusturulamadi");
    }
  }

  // --- DELETE /api/admin/measurements/:id
  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const measurementId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      if (!measurementId) throw new AppError("VALIDATION_ERROR", 400, "id zorunlu");

      const repo = AppDataSource.getRepository(Measurement);
      const measurement = await repo.findOne({
        where: { id: measurementId, tenant_id: tenantId, deleted_at: IsNull() },
      });
      if (!measurement) {
        throw new AppError("MEASUREMENT_NOT_FOUND", 404, "Olcum bulunamadi");
      }
      const oldState = {
        member_id: measurement.member_id,
        trainer_id: measurement.trainer_id,
        measured_at: measurement.measured_at.toISOString(),
      };
      measurement.deleted_at = new Date();
      await repo.save(measurement);
      await AdminMeasurementsController.logMeasurementAudit(req, {
        eventType: "ADMIN_MEASUREMENT_ARCHIVED",
        measurement,
        oldState,
      });
      return res.json({ message: "Olcum arşivlendi" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin measurements remove error:", error);
      throw new AppError("ADMIN_MEASUREMENTS_REMOVE_ERROR", 500, "Olcum silinemedi");
    }
  }
}
