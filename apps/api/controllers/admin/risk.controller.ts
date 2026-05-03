// Bu controller admin tarafindaki risk.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { RiskLevel, RiskService } from "../../services/risk.service";
import { RiskNotificationService } from "../../services/risk-notification.service";

export class AdminRiskController {
  // --- GET /api/admin/risk/members ---
  static async listRiskMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
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
      const memberActivityRaw = String(req.query.memberActivity ?? "").toUpperCase();
      const memberActivity =
        memberActivityRaw === "ACTIVE" || memberActivityRaw === "INACTIVE" || memberActivityRaw === "ALL"
          ? memberActivityRaw
          : undefined;
      const onlyAtRisk = String(req.query.onlyAtRisk ?? "").toLowerCase() === "true";
      const onlyActive = String(req.query.onlyActive ?? "").toLowerCase() === "true";
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await RiskService.listRiskMembers({
        tenantId,
        riskSegment,
        memberActivity,
        onlyActive,
        level,
        onlyAtRisk,
        limit,
      });

      return res.json({
        data: result.data,
        total: result.total,
        limit: result.limit,
        filter_help: {
          default_limit: 100,
          max_limit: 500,
          description: "Limit, listede donen uye sayisini belirler.",
        },
        filters: {
          level: level ?? null,
          riskSegment: riskSegment ?? (onlyAtRisk ? "AT_RISK" : "ALL"),
          memberActivity: memberActivity ?? (onlyActive ? "ACTIVE" : "ALL"),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin risk list error:", error);
      throw new AppError("ADMIN_RISK_LIST_ERROR", 500, "Risk listesi getirilemedi");
    }
  }

  // --- GET /api/admin/risk/members/:memberId ---
  static async getMemberRiskDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = String(req.params.memberId ?? "").trim();
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }
      if (!memberId) {
        throw new AppError("VALIDATION_ERROR", 400, "memberId zorunlu");
      }

      const detail = await RiskService.getMemberRiskDetail(tenantId, memberId);
      if (!detail) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }

      return res.json({ data: detail });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin risk detail error:", error);
      throw new AppError("ADMIN_RISK_DETAIL_ERROR", 500, "Risk detayi getirilemedi");
    }
  }

  // --- POST /api/admin/risk/recalculate ---
  static async recalculate(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.body?.memberId ? String(req.body.memberId).trim() : undefined;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const result = await RiskService.recalculate({ tenantId, memberId });
      return res.json({
        data: {
          processed: result.processed,
          saved: result.saved,
          preview: result.data.slice(0, 10),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin risk recalculate error:", error);
      throw new AppError("ADMIN_RISK_RECALCULATE_ERROR", 500, "Risk skorları hesaplanamadi");
    }
  }

  // --- POST /api/admin/risk/notifications/trigger ---
  static async triggerNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const adminId = req.auth?.sub;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const rawRiskSegment = String(req.body?.riskSegment ?? "AT_RISK").toUpperCase();
      const riskSegment =
        rawRiskSegment === "AT_RISK" || rawRiskSegment === "HEALTHY" || rawRiskSegment === "ALL"
          ? rawRiskSegment
          : "AT_RISK";
      const memberIds = Array.isArray(req.body?.memberIds)
        ? req.body.memberIds.map((v: unknown) => String(v)).filter(Boolean)
        : undefined;

      const result = await RiskNotificationService.trigger({
        tenantId,
        triggeredByAdminId: adminId,
        memberIds,
        riskSegment,
      });

      return res.json({ data: result });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin risk notifications trigger error:", error);
      throw new AppError("ADMIN_RISK_NOTIFICATIONS_TRIGGER_ERROR", 500, "Risk bildirim tetigi calistirilamadi");
    }
  }

  // --- GET /api/admin/risk/notifications/logs ---
  static async notificationLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const result = await RiskNotificationService.logs(tenantId, limit);
      return res.json(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin risk notifications logs error:", error);
      throw new AppError("ADMIN_RISK_NOTIFICATIONS_LOGS_ERROR", 500, "Risk bildirim loglari getirilemedi");
    }
  }
}
