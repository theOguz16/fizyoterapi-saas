// Bu controller member tarafindaki measurements.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Attendance } from "../../entities/attendance.entity";
import { Booking } from "../../entities/booking.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Measurement } from "../../entities/measurement.entity";
import { AuditLogService } from "../../services/audit-log.service";

export class MemberMeasurementsController {
  private static async logMeasurementAudit(req: AuthenticatedRequest, measurement: Measurement) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "MEMBER_MEASUREMENT_CREATED",
      action: "MEMBER_MEASUREMENT_CREATED",
      method: req.method,
      path: req.originalUrl,
      status_code: 201,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "measurement",
      target_id: measurement.id,
      metadata: {
        member_id: measurement.member_id,
        trainer_id: measurement.trainer_id,
      },
    });
  }

  private static parseOptionalNumeric(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || String(value).trim() === "") {
      return undefined;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} geçersiz sayı`);
    }
    return n.toFixed(2);
  }

  private static parseMeasuredAt(value: unknown) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return new Date();
    }
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, "measured_at geçersiz");
    }
    return dt;
  }

  private static toDto(row: Measurement) {
    return {
      id: row.id,
      measured_at: row.measured_at,
      height_cm: row.height_cm ?? null,
      weight_kg: row.weight_kg ?? null,
      fat_percent: row.fat_percent ?? null,
      muscle_kg: row.muscle_kg ?? null,
      extras: row.extras ?? {},
      trainer_id: row.trainer_id,
    };
  }

  // --- POST /api/member/measurements
  static async createMine(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const [latestBooking, latestAttendance] = await Promise.all([
        AppDataSource.getRepository(Booking).findOne({
          where: { tenant_id: tenantId, member_id: memberId },
          order: { starts_at: "DESC" },
          select: ["trainer_id"],
        }),
        AppDataSource.getRepository(Attendance).findOne({
          where: { tenant_id: tenantId, member_id: memberId },
          order: { created_at: "DESC" },
          select: ["trainer_id"],
        }),
      ]);
      const trainerId = latestBooking?.trainer_id || latestAttendance?.trainer_id || memberId;

      const measurement = AppDataSource.getRepository(Measurement).create({
        tenant_id: tenantId,
        member_id: memberId,
        trainer_id: trainerId,
        measured_at: MemberMeasurementsController.parseMeasuredAt(req.body?.measured_at),
        height_cm: MemberMeasurementsController.parseOptionalNumeric(req.body?.height_cm, "height_cm"),
        weight_kg: MemberMeasurementsController.parseOptionalNumeric(req.body?.weight_kg, "weight_kg"),
        fat_percent: MemberMeasurementsController.parseOptionalNumeric(req.body?.fat_percent, "fat_percent"),
        muscle_kg: MemberMeasurementsController.parseOptionalNumeric(req.body?.muscle_kg, "muscle_kg"),
        extras:
          req.body?.extras && typeof req.body.extras === "object" && !Array.isArray(req.body.extras)
            ? req.body.extras
            : {},
      });
      await AppDataSource.getRepository(Measurement).save(measurement);
      await MemberMeasurementsController.logMeasurementAudit(req, measurement);
      return res.status(201).json({ data: MemberMeasurementsController.toDto(measurement) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member measurements createMine error:", error);
      throw new AppError("MEMBER_MEASUREMENTS_CREATE_ERROR", 500, "Ölçüm kaydı oluşturulamadı");
    }
  }

  // --- GET /api/member/measurements
  static async listMine(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const rows = await AppDataSource.getRepository(Measurement).find({
        where: { tenant_id: tenantId, member_id: memberId, deleted_at: IsNull() },
        order: { measured_at: "DESC" },
      });

      return res.json({ data: rows.map((row) => MemberMeasurementsController.toDto(row)) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member measurements listMine error:", error);
      throw new AppError("MEMBER_MEASUREMENTS_LIST_ERROR", 500, "Ölçüm geçmişi getirilemedi");
    }
  }

  // --- GET /api/member/measurements/trend
  static async trendMine(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
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
      console.error("Member measurements trendMine error:", error);
      throw new AppError("MEMBER_MEASUREMENTS_TREND_ERROR", 500, "Ölçüm trendi getirilemedi");
    }
  }
}
