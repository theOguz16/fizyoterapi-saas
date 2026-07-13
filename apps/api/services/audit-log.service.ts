import { randomUUID } from "crypto";
import { Response } from "express";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";
import { AuditLog } from "../entities/audit-log.entity";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

type AuditErrorInfo = {
  code?: string | null;
  message?: string | null;
};

type AuditLogInput = {
  tenant_id?: string | null;
  actor_user_id?: string | null;
  actor_account_id?: string | null;
  actor_role?: string | null;
  event_type: string;
  action: string;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  success?: boolean | null;
  duration_ms?: number | null;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const PRODUCT_EVENT_NAMES = [
  "app_opened",
  "clinic_signup_started",
  "clinic_created",
  "trial_started",
  "package_created",
  "working_hours_saved",
  "clinic_qr_viewed",
  "member_invite_started",
  "subscription_viewed",
  "purchase_started",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

type ProductEventInput = {
  event_name: ProductEventName;
  event_id?: string | null;
  occurred_at?: string | Date | null;
  install_id?: string | null;
  session_id?: string | null;
  tenant_id?: string | null;
  actor_user_id?: string | null;
  actor_account_id?: string | null;
  actor_role?: string | null;
  method?: string | null;
  path?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined) {
  if (!input) return null;
  try {
    return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function attachAuditError(res: Response, code?: string | null, message?: string | null) {
  res.locals = res.locals || {};
  res.locals.auditError = {
    code: sanitizeText(code, 120),
    message: sanitizeText(message, 2000),
  } satisfies AuditErrorInfo;
}

export class AuditLogService {
  static ensureRequestId(req: AuthenticatedRequest) {
    const existing = sanitizeText(req.headers?.["x-request-id"], 120);
    const requestId = existing || randomUUID();
    req.requestId = requestId;
    return requestId;
  }

  static getAuditError(res: Response) {
    res.locals = res.locals || {};
    const auditError = (res.locals.auditError || {}) as AuditErrorInfo;
    return {
      code: sanitizeText(auditError.code, 120),
      message: sanitizeText(auditError.message, 2000),
    };
  }

  static async log(input: AuditLogInput, manager?: EntityManager) {
    if (!manager && !AppDataSource.isInitialized) return;

    try {
      const repo = manager ? manager.getRepository(AuditLog) : AppDataSource.getRepository(AuditLog);
      const entity = repo.create({
        tenant_id: input.tenant_id || null,
        actor_user_id: input.actor_user_id || null,
        actor_account_id: input.actor_account_id || null,
        actor_role: sanitizeText(input.actor_role, 40),
        event_type: sanitizeText(input.event_type, 80) || "UNKNOWN",
        action: sanitizeText(input.action, 120) || "UNKNOWN",
        method: sanitizeText(input.method, 10),
        path: sanitizeText(input.path, 500),
        status_code: typeof input.status_code === "number" ? input.status_code : null,
        success: typeof input.success === "boolean" ? input.success : null,
        duration_ms: typeof input.duration_ms === "number" ? input.duration_ms : null,
        request_id: sanitizeText(input.request_id, 120),
        ip_address: sanitizeText(input.ip_address, 120),
        user_agent: sanitizeText(input.user_agent, 1000),
        target_type: sanitizeText(input.target_type, 120),
        target_id: sanitizeText(input.target_id, 120),
        error_code: sanitizeText(input.error_code, 120),
        error_message: sanitizeText(input.error_message, 2000),
        metadata: sanitizeMetadata(input.metadata),
      });
      await repo.save(entity);
    } catch (error) {
      console.error("Audit log write error:", error);
    }
  }

  static async logProductEvent(input: ProductEventInput, manager?: EntityManager) {
    if (!manager && !AppDataSource.isInitialized) return false;

    const eventId = sanitizeText(input.event_id, 120) || randomUUID();
    const eventType = input.event_name.toUpperCase();
    const repo = manager ? manager.getRepository(AuditLog) : AppDataSource.getRepository(AuditLog);

    try {
      const duplicate = await repo.findOne({
        where: { event_type: eventType, request_id: eventId },
        select: ["id"],
      });
      if (duplicate) return false;

      const occurredAtRaw = input.occurred_at instanceof Date ? input.occurred_at : new Date(input.occurred_at || Date.now());
      const occurredAt = Number.isNaN(occurredAtRaw.getTime()) ? new Date() : occurredAtRaw;

      const entity = repo.create({
        tenant_id: input.tenant_id || null,
        actor_user_id: input.actor_user_id || null,
        actor_account_id: input.actor_account_id || null,
        actor_role: sanitizeText(input.actor_role, 40),
        event_type: eventType,
        action: eventType,
        method: sanitizeText(input.method, 10),
        path: sanitizeText(input.path, 500),
        status_code: 200,
        success: true,
        request_id: eventId,
        ip_address: sanitizeText(input.ip_address, 120),
        user_agent: sanitizeText(input.user_agent, 1000),
        target_type: sanitizeText(input.target_type, 120),
        target_id: sanitizeText(input.target_id, 120),
        metadata: sanitizeMetadata({
          event_name: input.event_name,
          event_id: eventId,
          occurred_at: occurredAt.toISOString(),
          install_id: sanitizeText(input.install_id, 120),
          session_id: sanitizeText(input.session_id, 120),
          ...(input.metadata || {}),
        }),
      });
      await repo.save(entity);
      return true;
    } catch (error) {
      console.error("Product event write error:", error);
      return false;
    }
  }
}
