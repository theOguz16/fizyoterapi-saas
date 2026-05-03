import { Response } from "express";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../../data-source";
import { AuditLog } from "../../entities/audit-log.entity";
import { Tenant } from "../../entities/tenant.entity";
import { AppError } from "../../errors/AppError";

function normalizeRoleFilter(value: unknown) {
  const role = String(value || "").trim().toUpperCase();
  if (!role) return null;
  if (role === "SALON-ADMIN" || role === "SALON_ADMIN" || role === "CLINIC_ADMIN") {
    return "ADMIN";
  }
  if (role === "ADMIN" || role === "TRAINER" || role === "MEMBER") {
    return role;
  }
  return role;
}

function applyDateFilter<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  field: string,
  operator: ">=" | "<=",
  value: unknown,
  key: string
) {
  if (!value || typeof value !== "string") return;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;
  query.andWhere(`${field} ${operator} :${key}`, { [key]: date.toISOString() });
}

export class InternalAuditLogsController {
  static async list(req: any, res: Response) {
    try {
      const rawLimit = req.query.limit ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 1000) : 100;
      const role = normalizeRoleFilter(req.query.role);
      const eventType = typeof req.query.event_type === "string" ? req.query.event_type.trim().toUpperCase() : null;
      const routeGroup = typeof req.query.route_group === "string" ? req.query.route_group.trim().toUpperCase() : null;
      const actionKind = typeof req.query.action_kind === "string" ? req.query.action_kind.trim().toUpperCase() : null;
      const method = typeof req.query.method === "string" ? req.query.method.trim().toUpperCase() : null;
      const tenantId = typeof req.query.tenant_id === "string" ? req.query.tenant_id.trim() : null;
      const tenantSlug = typeof req.query.tenant_slug === "string" ? req.query.tenant_slug.trim().toLowerCase() : null;
      const targetType = typeof req.query.target_type === "string" ? req.query.target_type.trim() : null;
      const targetId = typeof req.query.target_id === "string" ? req.query.target_id.trim() : null;
      const actorUserId = typeof req.query.actor_user_id === "string" ? req.query.actor_user_id.trim() : null;
      const actorAccountId = typeof req.query.actor_account_id === "string" ? req.query.actor_account_id.trim() : null;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const success = typeof req.query.success === "string" ? req.query.success.trim().toLowerCase() : null;
      const statusCode = req.query.status_code ? Number(req.query.status_code) : null;

      const query = AppDataSource.getRepository(AuditLog)
        .createQueryBuilder("audit")
        .leftJoin(Tenant, "tenant", "tenant.id = audit.tenant_id")
        .select([
          "audit.id AS id",
          "audit.created_at AS created_at",
          "audit.tenant_id AS tenant_id",
          "tenant.slug AS tenant_slug",
          "tenant.name AS tenant_name",
          "audit.actor_user_id AS actor_user_id",
          "audit.actor_account_id AS actor_account_id",
          "audit.actor_role AS actor_role",
          "audit.event_type AS event_type",
          "audit.action AS action",
          "audit.method AS method",
          "audit.path AS path",
          "audit.status_code AS status_code",
          "audit.success AS success",
          "audit.duration_ms AS duration_ms",
          "audit.request_id AS request_id",
          "audit.ip_address AS ip_address",
          "audit.user_agent AS user_agent",
          "audit.target_type AS target_type",
          "audit.target_id AS target_id",
          "audit.error_code AS error_code",
          "audit.error_message AS error_message",
          "audit.metadata AS metadata",
        ])
        .orderBy("audit.created_at", "DESC")
        .take(limit);

      if (role) {
        query.andWhere("audit.actor_role = :role", { role });
      }
      if (eventType) {
        query.andWhere("audit.event_type = :eventType", { eventType });
      }
      if (routeGroup) {
        query.andWhere("audit.metadata ->> 'route_group' = :routeGroup", { routeGroup });
      }
      if (actionKind) {
        query.andWhere("audit.metadata ->> 'action_kind' = :actionKind", { actionKind });
      }
      if (method) {
        query.andWhere("audit.method = :method", { method });
      }
      if (tenantId) {
        query.andWhere("audit.tenant_id = :tenantId", { tenantId });
      }
      if (tenantSlug) {
        query.andWhere("LOWER(tenant.slug) = :tenantSlug", { tenantSlug });
      }
      if (targetType) {
        query.andWhere("audit.target_type = :targetType", { targetType });
      }
      if (targetId) {
        query.andWhere("audit.target_id = :targetId", { targetId });
      }
      if (actorUserId) {
        query.andWhere("audit.actor_user_id = :actorUserId", { actorUserId });
      }
      if (actorAccountId) {
        query.andWhere("audit.actor_account_id = :actorAccountId", { actorAccountId });
      }
      if (success === "true" || success === "false") {
        query.andWhere("audit.success = :success", { success: success === "true" });
      }
      if (Number.isFinite(statusCode)) {
        query.andWhere("audit.status_code = :statusCode", { statusCode });
      }
      if (search) {
        query.andWhere(
          `(
            audit.action ILIKE :search OR
            audit.path ILIKE :search OR
            audit.error_code ILIKE :search OR
            audit.error_message ILIKE :search OR
            audit.target_id ILIKE :search OR
            audit.request_id ILIKE :search OR
            tenant.slug ILIKE :search OR
            tenant.name ILIKE :search
          )`,
          { search: `%${search}%` }
        );
      }

      applyDateFilter(query, "audit.created_at", ">=", req.query.from, "fromDate");
      applyDateFilter(query, "audit.created_at", "<=", req.query.to, "toDate");

      const rows = await query.getRawMany();
      return res.json({ data: rows, limit });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Internal audit logs list error:", error);
      throw new AppError("AUDIT_LOGS_LIST_ERROR", 500, "Audit loglari getirilemedi");
    }
  }
}
