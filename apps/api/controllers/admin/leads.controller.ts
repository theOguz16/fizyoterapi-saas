// Bu controller admin tarafindaki leads.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { LeadStatus, Lead } from "../../entities/lead.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";

export class AdminLeadsController {
  private static async logLeadAudit(
    req: AuthenticatedRequest,
    input: { eventType: string; lead: Lead; oldState?: Record<string, unknown> | null }
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
      target_type: "lead",
      target_id: input.lead.id,
      metadata: {
        full_name: input.lead.full_name,
        phone: input.lead.phone,
        status: input.lead.status,
        old_state: input.oldState ?? null,
      },
    });
  }

  private static validateStatus(status: unknown): asserts status is LeadStatus {
    if (typeof status !== "string" || !Object.values(LeadStatus).includes(status as LeadStatus)) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz lead status");
    }
  }

  // --- GET /api/admin/leads ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const q = req.query.q ? String(req.query.q).trim() : "";
      const status = req.query.status ? String(req.query.status) : "";
      const qb = AppDataSource.getRepository(Lead)
        .createQueryBuilder("l")
        .where("l.tenant_id = :tenantId", { tenantId })
        .orderBy("l.created_at", "DESC");

      if (q) {
        qb.andWhere("(l.full_name ILIKE :q OR l.phone ILIKE :q OR l.interest ILIKE :q)", { q: `%${q}%` });
      }
      if (status) {
        AdminLeadsController.validateStatus(status);
        qb.andWhere("l.status = :status", { status });
      }

      const rows = await qb.getMany();
      return res.json({ data: rows });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin leads list error:", error);
      throw new AppError("ADMIN_LEADS_LIST_ERROR", 500, "Lead listesi getirilemedi");
    }
  }

  // --- GET /api/admin/leads/:id ---
  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const leadId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const lead = await AppDataSource.getRepository(Lead).findOne({
        where: { id: leadId, tenant_id: tenantId },
      });
      if (!lead) {
        throw new AppError("LEAD_NOT_FOUND", 404, "Lead bulunamadi");
      }

      return res.json({ data: lead });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin leads getById error:", error);
      throw new AppError("ADMIN_LEADS_GET_ERROR", 500, "Lead detayi getirilemedi");
    }
  }

  // --- PATCH /api/admin/leads/:id/status ---
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const leadId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const status = req.body?.status;
      AdminLeadsController.validateStatus(status);

      const repo = AppDataSource.getRepository(Lead);
      const lead = await repo.findOne({ where: { id: leadId, tenant_id: tenantId } });
      if (!lead) {
        throw new AppError("LEAD_NOT_FOUND", 404, "Lead bulunamadi");
      }

      const oldState = { status: lead.status };
      lead.status = status;
      await repo.save(lead);
      await AdminLeadsController.logLeadAudit(req, {
        eventType: "ADMIN_LEAD_STATUS_CHANGED",
        lead,
        oldState,
      });
      return res.json({ data: lead });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin leads setStatus error:", error);
      throw new AppError("ADMIN_LEADS_STATUS_ERROR", 500, "Lead durumu guncellenemedi");
    }
  }

  // --- DELETE /api/admin/leads/:id ---
  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const leadId = String(req.params.id ?? "");
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");

      const repo = AppDataSource.getRepository(Lead);
      const lead = await repo.findOne({ where: { id: leadId, tenant_id: tenantId } });
      if (!lead) {
        throw new AppError("LEAD_NOT_FOUND", 404, "Lead bulunamadi");
      }

      await repo.remove(lead);
      await AdminLeadsController.logLeadAudit(req, {
        eventType: "ADMIN_LEAD_DELETED",
        lead,
      });
      return res.json({ message: "Lead silindi" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin leads remove error:", error);
      throw new AppError("ADMIN_LEADS_REMOVE_ERROR", 500, "Lead silinemedi");
    }
  }
}
