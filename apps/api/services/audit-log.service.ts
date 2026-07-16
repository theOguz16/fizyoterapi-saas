import { randomUUID } from "crypto";
import { isIP } from "net";
import {
  PRODUCT_EVENT_NAMES,
  type ProductEventName,
  type ProductFunnelReport,
} from "@fitnes-saas/contracts";
import { Response } from "express";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";
import { AuditLog } from "../entities/audit-log.entity";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { LoggerService } from "./logger.service";

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

export { PRODUCT_EVENT_NAMES };
export type { ProductEventName };

type ProductEventInput = {
  event_name: ProductEventName;
  event_id?: string | null;
  occurred_at?: string | Date | null;
  install_id?: string | null;
  session_id?: string | null;
  funnel_id?: string | null;
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

function sanitizeAuditPath(value: unknown) {
  const path = sanitizeText(value, 500);
  return path ? path.split(/[?#]/, 1)[0] || null : null;
}

function sanitizeAuditIpAddress(value: unknown): string | null {
  const ipAddress = sanitizeText(value, 120);
  if (!ipAddress) return null;
  const family = isIP(ipAddress);
  if (family === 4) {
    const octets = ipAddress.split(".");
    octets[3] = "0";
    return octets.join(".");
  }
  if (family !== 6) return null;

  const mappedIpv4 = ipAddress.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4 && isIP(mappedIpv4[2]) === 4) {
    return `${mappedIpv4[1]}${sanitizeAuditIpAddress(mappedIpv4[2])}`;
  }

  const [head = "", tail = ""] = ipAddress.split("::", 2);
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missingParts = Math.max(0, 8 - headParts.length - tailParts.length);
  const expanded = [...headParts, ...Array(missingParts).fill("0"), ...tailParts];
  return `${expanded.slice(0, 4).map((part) => part || "0").join(":")}::`;
}

function sanitizeAuditUserAgent(value: unknown) {
  const userAgent = sanitizeText(value, 1000);
  if (!userAgent) return null;
  if (/bot|crawler|spider/i.test(userAgent)) return "bot";
  if (/iphone|ipad|ios/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  if (/windows/i.test(userAgent)) return "windows";
  if (/macintosh|mac os/i.test(userAgent)) return "macos";
  if (/linux/i.test(userAgent)) return "linux";
  return "other";
}

const REDACTED_VALUE = "[REDACTED]";
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const INTERNATIONAL_PHONE_VALUE = /\+\d(?:[\s().-]*\d){7,14}/g;
const FORMATTED_PHONE_VALUE = /\b0\d{2,3}(?:[\s().-]+\d{2,4}){2,4}\b/g;
const SECRET_ASSIGNMENT = /\b(?:api[_ -]?key|authorization|password|secret|token)\s*[:=]\s*[^\s,;]+/gi;

function redactSensitiveString(value: string) {
  return value
    .replace(EMAIL_VALUE, REDACTED_VALUE)
    .replace(BEARER_VALUE, REDACTED_VALUE)
    .replace(JWT_VALUE, REDACTED_VALUE)
    .replace(INTERNATIONAL_PHONE_VALUE, REDACTED_VALUE)
    .replace(FORMATTED_PHONE_VALUE, REDACTED_VALUE)
    .replace(SECRET_ASSIGNMENT, REDACTED_VALUE);
}

const SENSITIVE_METADATA_KEYS = new Set([
  "address",
  "authorization",
  "body_measurement",
  "bmi",
  "blood_pressure",
  "comment",
  "contact",
  "content",
  "cookie",
  "credential",
  "description",
  "email",
  "email_or_phone",
  "extras",
  "first_name",
  "full_name",
  "height",
  "height_cm",
  "last_name",
  "measurement",
  "measured_at",
  "message",
  "mobile",
  "muscle_kg",
  "note",
  "notes",
  "password",
  "password_hash",
  "phone",
  "refresh_token",
  "search",
  "secret",
  "text",
  "token",
  "waist",
  "weight",
  "weight_kg",
  "fat_percent",
  "heart_rate",
  "health",
  "medical",
  "diagnosis",
  "symptom",
]);

function normalizeMetadataKey(key: string) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function isSensitiveMetadataKey(key: string) {
  const normalized = normalizeMetadataKey(key);
  if (normalized === "id" || normalized.endsWith("_id") || normalized.endsWith("_ids")) return false;
  if (SENSITIVE_METADATA_KEYS.has(normalized)) return true;
  const keyParts = new Set(normalized.split("_"));
  if (["measurement", "height", "weight", "fat", "muscle", "waist", "chest", "hip", "circumference"].some((part) => keyParts.has(part))) {
    return true;
  }
  return normalized.endsWith("_token")
    || normalized.endsWith("_secret")
    || normalized.endsWith("_password")
    || normalized.endsWith("_email")
    || normalized.endsWith("_phone")
    || normalized.endsWith("_address")
    || normalized.endsWith("_note")
    || normalized.endsWith("_notes")
    || normalized.endsWith("_comment")
    || normalized.endsWith("_content");
}

function isOperationalMetadataKey(key: string) {
  const normalized = normalizeMetadataKey(key);
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.endsWith("_status")
    || normalized.endsWith("_type")
    || normalized.endsWith("_role")
    || normalized.endsWith("_kind")
    || normalized.endsWith("_count")
    || normalized.endsWith("_version")
    || normalized.endsWith("_cycle")
    || normalized.endsWith("_at")
    || normalized.startsWith("is_")
    || normalized.startsWith("has_")
    || [
      "action",
      "billing_cycle",
      "days",
      "decision",
      "event_name",
      "method",
      "platform",
      "reason",
      "request_body_keys",
      "route_group",
      "screen",
      "source",
      "status",
    ].includes(normalized);
}

function redactMetadataValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveMetadataKey(key)) return REDACTED_VALUE;
  if (value === null || typeof value === "undefined") return value ?? null;
  if (Array.isArray(value)) {
    if (key && !isOperationalMetadataKey(key)) return REDACTED_VALUE;
    return value.map((item) => redactMetadataValue(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactMetadataValue(childValue, childKey),
      ])
    );
  }
  if (!key || isOperationalMetadataKey(key)) {
    return typeof value === "string" ? redactSensitiveString(value) : value;
  }
  return REDACTED_VALUE;
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined) {
  if (!input) return null;
  try {
    const jsonSafe = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
    return redactMetadataValue(jsonSafe) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeAuditMetadata(
  input: Record<string, unknown> | null | undefined,
  _eventType: string
) {
  return sanitizeMetadata(input);
}

export function attachAuditError(res: Response, code?: string | null, message?: string | null) {
  res.locals = res.locals || {};
  res.locals.auditError = {
    code: sanitizeText(code, 120),
    message: sanitizeText(message, 2000),
  } satisfies AuditErrorInfo;
}

export class AuditLogService {
  static productContextFromRequest(req: { headers?: Record<string, unknown> }) {
    const read = (name: string) => typeof req.headers?.[name] === "string" ? req.headers[name] as string : null;
    return {
      install_id: read("x-fizyoflow-install-id"),
      session_id: read("x-fizyoflow-session-id"),
      funnel_id: read("x-fizyoflow-funnel-id"),
    };
  }

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
        path: sanitizeAuditPath(input.path),
        status_code: typeof input.status_code === "number" ? input.status_code : null,
        success: typeof input.success === "boolean" ? input.success : null,
        duration_ms: typeof input.duration_ms === "number" ? input.duration_ms : null,
        request_id: sanitizeText(input.request_id, 120),
        ip_address: sanitizeAuditIpAddress(input.ip_address),
        user_agent: sanitizeAuditUserAgent(input.user_agent),
        target_type: sanitizeText(input.target_type, 120),
        target_id: sanitizeText(input.target_id, 120),
        error_code: sanitizeText(input.error_code, 120),
        error_message: sanitizeText(input.error_message, 2000) ? REDACTED_VALUE : null,
        metadata: sanitizeAuditMetadata(input.metadata, input.event_type),
      });
      await repo.save(entity);
    } catch (error) {
      LoggerService.error("audit_log_write_failed", error, {
        event_type: sanitizeText(input.event_type, 80) || "UNKNOWN",
        request_id: sanitizeText(input.request_id, 120),
      });
    }
  }

  static async logProductEvent(input: ProductEventInput, manager?: EntityManager) {
    if (!manager && !AppDataSource.isInitialized) return false;

    const eventId = sanitizeText(input.event_id, 120) || randomUUID();
    const eventType = input.event_name.toUpperCase();
    const repo = manager ? manager.getRepository(AuditLog) : AppDataSource.getRepository(AuditLog);

    try {
      const duplicate = await repo.findOne({
        where: { product_event_name: input.event_name, product_event_id: eventId },
        select: ["id"],
      });
      if (duplicate) return false;

      const occurredAtRaw = input.occurred_at instanceof Date ? input.occurred_at : new Date(input.occurred_at || Date.now());
      const occurredAt = Number.isNaN(occurredAtRaw.getTime()) ? new Date() : occurredAtRaw;
      const installId = sanitizeText(input.install_id, 120);
      const sessionId = sanitizeText(input.session_id, 120);
      const funnelId = sanitizeText(input.funnel_id, 120) || installId || sanitizeText(input.actor_account_id, 120);

      const entity = repo.create({
        tenant_id: input.tenant_id || null,
        actor_user_id: input.actor_user_id || null,
        actor_account_id: input.actor_account_id || null,
        actor_role: sanitizeText(input.actor_role, 40),
        event_type: eventType,
        action: eventType,
        method: sanitizeText(input.method, 10),
        path: sanitizeAuditPath(input.path),
        status_code: 200,
        success: true,
        request_id: eventId,
        ip_address: sanitizeAuditIpAddress(input.ip_address),
        user_agent: sanitizeAuditUserAgent(input.user_agent),
        target_type: sanitizeText(input.target_type, 120),
        target_id: sanitizeText(input.target_id, 120),
        product_event_name: input.event_name,
        product_event_id: eventId,
        product_funnel_id: funnelId,
        product_install_id: installId,
        product_session_id: sessionId,
        product_occurred_at: occurredAt,
        metadata: sanitizeMetadata({
          ...(input.metadata || {}),
          event_name: input.event_name,
          event_id: eventId,
          occurred_at: occurredAt.toISOString(),
          install_id: installId,
          session_id: sessionId,
          funnel_id: funnelId,
        }),
      });
      await repo.save(entity);
      return true;
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") return false;
      LoggerService.error("product_event_write_failed", error, {
        event_name: input.event_name,
        event_id: eventId,
      });
      throw error;
    }
  }

  static async getProductFunnelReport(input: {
    from: Date;
    to: Date;
    tenant_id?: string | null;
  }): Promise<ProductFunnelReport> {
    const query = AppDataSource.getRepository(AuditLog)
      .createQueryBuilder("audit")
      .select("audit.product_event_name", "event_name")
      .addSelect("COUNT(audit.id)", "event_count")
      .addSelect("COUNT(DISTINCT audit.product_funnel_id)", "unique_funnels")
      .addSelect("COUNT(DISTINCT audit.actor_account_id)", "unique_accounts")
      .addSelect("COUNT(DISTINCT audit.tenant_id)", "unique_tenants")
      .where("audit.product_event_name IN (:...eventNames)", { eventNames: [...PRODUCT_EVENT_NAMES] })
      .andWhere("audit.product_occurred_at >= :from", { from: input.from })
      .andWhere("audit.product_occurred_at <= :to", { to: input.to })
      .groupBy("audit.product_event_name");

    if (input.tenant_id) query.andWhere("audit.tenant_id = :tenantId", { tenantId: input.tenant_id });
    const rows = await query.getRawMany<{
      event_name: ProductEventName;
      event_count: string;
      unique_funnels: string;
      unique_accounts: string;
      unique_tenants: string;
    }>();
    const byName = new Map(rows.map((row) => [row.event_name, row]));
    let previousFunnels: number | null = null;
    const steps = PRODUCT_EVENT_NAMES.map((eventName) => {
      const row = byName.get(eventName);
      const uniqueFunnels = Number(row?.unique_funnels || 0);
      const conversion = previousFunnels === null || previousFunnels === 0
        ? null
        : Math.round((uniqueFunnels / previousFunnels) * 1000) / 10;
      previousFunnels = uniqueFunnels;
      return {
        event_name: eventName,
        event_count: Number(row?.event_count || 0),
        unique_funnels: uniqueFunnels,
        unique_accounts: Number(row?.unique_accounts || 0),
        unique_tenants: Number(row?.unique_tenants || 0),
        conversion_from_previous_percent: conversion,
      };
    });

    return {
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      tenant_id: input.tenant_id || null,
      steps,
    };
  }
}
