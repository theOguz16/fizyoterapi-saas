// Bu controller trainer tarafindaki risk.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Attendance } from "../../entities/attendance.entity";
import { Booking } from "../../entities/booking.entity";
import { Measurement } from "../../entities/measurement.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { RiskLevel, RiskService } from "../../services/risk.service";

export class TrainerRiskController {
  private static async resolveTrainerMemberIds(tenantId: string, trainerId: string) {
    const [bookingRows, attendanceRows, measurementRows] = await Promise.all([
      AppDataSource.getRepository(Booking)
        .createQueryBuilder("b")
        .select("DISTINCT b.member_id", "member_id")
        .where("b.tenant_id = :tenantId", { tenantId })
        .andWhere("b.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
      AppDataSource.getRepository(Attendance)
        .createQueryBuilder("a")
        .select("DISTINCT a.member_id", "member_id")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
      AppDataSource.getRepository(Measurement)
        .createQueryBuilder("m")
        .select("DISTINCT m.member_id", "member_id")
        .where("m.tenant_id = :tenantId", { tenantId })
        .andWhere("m.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
    ]);

    return Array.from(
      new Set<string>([
        ...bookingRows.map((row) => row.member_id),
        ...attendanceRows.map((row) => row.member_id),
        ...measurementRows.map((row) => row.member_id),
      ])
    );
  }

  // --- GET /api/trainer/risk/members ---
  static async listRiskMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!trainerId) {
        throw new AppError("NO_AUTH", 400, "Auth bilgisi bulunamadi");
      }

      const levelRaw = String(req.query.level ?? "").toUpperCase();
      const level = (["HIGH", "MEDIUM", "LOW"] as const).includes(levelRaw as RiskLevel)
        ? (levelRaw as RiskLevel)
        : undefined;
      const riskSegmentRaw = String(req.query.riskSegment ?? "").toUpperCase();
      const riskSegment =
        riskSegmentRaw === "AT_RISK" || riskSegmentRaw === "HEALTHY" || riskSegmentRaw === "ALL"
          ? riskSegmentRaw
          : undefined;
      const onlyAtRisk = String(req.query.onlyAtRisk ?? "true").toLowerCase() !== "false";
      const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
      const memberIds = await TrainerRiskController.resolveTrainerMemberIds(tenantId, trainerId);

      if (memberIds.length === 0) {
        return res.json({
          data: [],
          total: 0,
          filters: {
            level: level ?? null,
            riskSegment: riskSegment ?? (onlyAtRisk ? "AT_RISK" : "ALL"),
            memberActivity: "ACTIVE",
          },
        });
      }

      const result = await RiskService.listRiskMembers({
        tenantId,
        memberIds,
        memberActivity: "ACTIVE",
        riskSegment,
        onlyActive: true,
        level,
        onlyAtRisk,
        limit,
      });

      return res.json({
        data: result.data,
        total: result.total,
        limit: result.limit,
        filters: {
          level: level ?? null,
          riskSegment: riskSegment ?? (onlyAtRisk ? "AT_RISK" : "ALL"),
          memberActivity: "ACTIVE",
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer risk list error:", error);
      throw new AppError("TRAINER_RISK_LIST_ERROR", 500, "Risk listesi getirilemedi");
    }
  }

  // --- GET /api/trainer/risk/members/:memberId ---
  static async getMemberRiskDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.memberId ?? "").trim();
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!trainerId) {
        throw new AppError("NO_AUTH", 400, "Auth bilgisi bulunamadi");
      }
      if (!memberId) {
        throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
      }

      const scopedMemberIds = await TrainerRiskController.resolveTrainerMemberIds(tenantId, trainerId);
      if (!scopedMemberIds.includes(memberId)) {
        throw new AppError("MEMBER_SCOPE_FORBIDDEN", 403, "Bu uye trainer kapsaminda degil");
      }

      const detail = await RiskService.getMemberRiskDetail(tenantId, memberId);
      if (!detail) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }

      return res.json({ data: detail });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer risk detail error:", error);
      throw new AppError("TRAINER_RISK_DETAIL_ERROR", 500, "Risk detayi getirilemedi");
    }
  }
}
