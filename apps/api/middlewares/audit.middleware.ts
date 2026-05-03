import { NextFunction, Response } from "express";
import { AuditLogService } from "../services/audit-log.service";
import { AuthenticatedRequest } from "./auth.middleware";

type AuditResponseSummary = {
  data_id?: string | null;
  item_count?: number | null;
  has_data?: boolean;
};

function buildEventType(req: AuthenticatedRequest, statusCode: number) {
  if (String(req.originalUrl || "").startsWith("/api/auth/")) {
    return statusCode >= 400 ? "AUTH_ERROR" : "AUTH";
  }
  if (String(req.originalUrl || "").startsWith("/api/internal/")) {
    return statusCode >= 400 ? "INTERNAL_ERROR" : "INTERNAL_ACTION";
  }
  if (String(req.originalUrl || "").startsWith("/api/public/")) {
    return statusCode >= 400 ? "PUBLIC_ERROR" : "PUBLIC_ACTION";
  }
  if (statusCode >= 500) return "ERROR";
  if (statusCode >= 400) return "REQUEST_ERROR";
  return "REQUEST";
}

function buildAction(req: AuthenticatedRequest) {
  const routePath = typeof req.route?.path === "string" ? req.route.path : null;
  const base = req.baseUrl || "";
  const path = routePath ? `${base}${routePath}` : req.path || req.originalUrl || "/";
  return `${String(req.method || "GET").toUpperCase()} ${path}`;
}

function buildActionKind(req: AuthenticatedRequest) {
  const method = String(req.method || "").toUpperCase();
  if (String(req.originalUrl || "").startsWith("/api/auth/login")) return "LOGIN";
  if (String(req.originalUrl || "").startsWith("/api/auth/register")) return "REGISTER";
  if (String(req.originalUrl || "").startsWith("/api/auth/logout")) return "LOGOUT";
  if (method === "POST") return "CREATE";
  if (method === "PUT" || method === "PATCH") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return "READ";
}

function shouldAudit(req: AuthenticatedRequest, res: Response) {
  const path = String(req.originalUrl || "");
  if (path === "/health" || path.startsWith("/uploads")) return false;
  if (String(req.method || "").toUpperCase() === "OPTIONS") return false;
  return true;
}

function buildMetadata(req: AuthenticatedRequest, statusCode: number) {
  const metadata: Record<string, unknown> = {};
  const responseSummary = (req.res?.locals.auditResponseSummary || null) as AuditResponseSummary | null;

  if (typeof req.query.limit !== "undefined") metadata.limit = req.query.limit;
  if (typeof req.query.page !== "undefined") metadata.page = req.query.page;
  if (typeof req.query.role !== "undefined") metadata.role_filter = req.query.role;
  if (typeof req.query.search !== "undefined") metadata.search = req.query.search;
  if (req.params?.id) metadata.param_id = String(req.params.id);
  metadata.route_group = resolveRouteGroup(req);
  metadata.action_kind = buildActionKind(req);
  metadata.request_has_body = Boolean(req.body && typeof req.body === "object" && Object.keys(req.body).length > 0);
  metadata.request_body_keys = summarizeBodyKeys(req.body);

  if (String(req.originalUrl || "").startsWith("/api/auth/")) {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : null;
    if (email) metadata.email = email;
  }

  const linkedIds = extractLinkedIds(req.body);
  if (Object.keys(linkedIds).length) {
    metadata.related_ids = linkedIds;
  }

  if (statusCode >= 400 && typeof req.body?.id === "string") {
    metadata.body_id = req.body.id;
  }
  if (typeof req.body?.status === "string") {
    metadata.request_status = req.body.status;
  }
  if (typeof req.body?.days !== "undefined") {
    metadata.days = req.body.days;
  }
  if (responseSummary) {
    metadata.response_has_data = responseSummary.has_data;
    if (responseSummary.data_id) metadata.response_data_id = responseSummary.data_id;
    if (typeof responseSummary.item_count === "number") metadata.response_item_count = responseSummary.item_count;
  }

  return Object.keys(metadata).length ? metadata : null;
}

function resolveRouteGroup(req: AuthenticatedRequest) {
  const url = String(req.originalUrl || "");
  if (url.startsWith("/api/internal/")) return "INTERNAL";
  if (url.startsWith("/api/auth/")) return "AUTH";
  if (url.startsWith("/api/admin/")) return "SALON_ADMIN";
  if (url.startsWith("/api/trainer/")) return "TRAINER";
  if (url.startsWith("/api/member/")) return "MEMBER";
  if (url.startsWith("/api/public/")) return "PUBLIC";
  return "OTHER";
}

export function auditMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const requestId = AuditLogService.ensureRequestId(req);
  res.setHeader("x-request-id", requestId);
  patchJsonResponse(req, res);

  res.on("finish", () => {
    if (!shouldAudit(req, res)) return;

    const auditError = AuditLogService.getAuditError(res);
    const statusCode = res.statusCode || 200;
    const targetId = sanitizeTargetId(req);

    void AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || (req.auth?.loginScope === "LEGACY" ? req.auth?.sub : null) || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: buildEventType(req, statusCode),
      action: buildAction(req),
      method: req.method,
      path: req.originalUrl,
      status_code: statusCode,
      success: statusCode < 400,
      duration_ms: Date.now() - startedAt,
      request_id: requestId,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: inferTargetType(req),
      target_id: targetId,
      error_code: auditError.code,
      error_message: auditError.message,
      metadata: buildMetadata(req, statusCode),
    });
  });

  next();
}

function patchJsonResponse(req: AuthenticatedRequest, res: Response) {
  const originalJson = res.json.bind(res);
  res.json = ((body?: any) => {
    res.locals.auditResponseSummary = summarizeResponseBody(body);
    const responseTargetId = extractResponseTargetId(body);
    if (responseTargetId) {
      res.locals.auditResponseTargetId = responseTargetId;
    }
    return originalJson(body);
  }) as typeof res.json;
}

function inferTargetType(req: AuthenticatedRequest) {
  const base = String(req.baseUrl || req.originalUrl || "");
  const parts = base.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

function sanitizeTargetId(req: AuthenticatedRequest) {
  const value =
    (typeof req.res?.locals.auditResponseTargetId === "string" && req.res.locals.auditResponseTargetId) ||
    (typeof req.params?.id === "string" && req.params.id) ||
    (typeof req.body?.id === "string" && req.body.id) ||
    (typeof req.body?.member_id === "string" && req.body.member_id) ||
    (typeof req.body?.trainer_id === "string" && req.body.trainer_id) ||
    (typeof req.body?.package_id === "string" && req.body.package_id) ||
    (typeof req.body?.session_id === "string" && req.body.session_id) ||
    null;
  if (!value) return null;
  return String(value).slice(0, 120);
}

function summarizeBodyKeys(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>).slice(0, 20);
}

function extractLinkedIds(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const keys = ["member_id", "trainer_id", "package_id", "session_id", "booking_id", "measurement_id", "note_id"];
  const result: Record<string, string> = {};
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) {
      result[key] = String(record[key]).slice(0, 120);
    }
  }
  return result;
}

function summarizeResponseBody(body: any): AuditResponseSummary | null {
  if (!body || typeof body !== "object") return null;
  const data = body?.data;
  if (Array.isArray(data)) {
    return {
      has_data: true,
      item_count: data.length,
      data_id: extractId(data[0]),
    };
  }
  if (data && typeof data === "object") {
    return {
      has_data: true,
      item_count: null,
      data_id: extractId(data),
    };
  }
  return {
    has_data: typeof data !== "undefined",
    item_count: null,
    data_id: extractId(body),
  };
}

function extractResponseTargetId(body: any) {
  if (!body || typeof body !== "object") return null;
  const data = body?.data;
  return extractId(data) || extractId(body);
}

function extractId(value: any) {
  if (!value || typeof value !== "object") return null;
  const candidate =
    (typeof value.id === "string" && value.id) ||
    (typeof value.member_id === "string" && value.member_id) ||
    (typeof value.booking_id === "string" && value.booking_id) ||
    (typeof value.session_id === "string" && value.session_id) ||
    null;
  return candidate ? String(candidate).slice(0, 120) : null;
}
