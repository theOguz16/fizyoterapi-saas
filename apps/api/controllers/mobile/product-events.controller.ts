import { Response } from "express";
import { AUTHENTICATED_PRODUCT_EVENT_NAMES, type ProductEventName } from "@fitnes-saas/contracts";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";

const AUTHENTICATED_PRODUCT_EVENTS = new Set<ProductEventName>(AUTHENTICATED_PRODUCT_EVENT_NAMES);

export class MobileProductEventsController {
  static async track(req: AuthenticatedRequest, res: Response) {
    const eventName = String(req.body?.event_name || "").trim().toLowerCase() as ProductEventName;
    if (!AUTHENTICATED_PRODUCT_EVENTS.has(eventName)) {
      throw new AppError("INVALID_PRODUCT_EVENT", 422, "Geçersiz oturumlu ürün olayı");
    }

    const metadataRaw = req.body?.metadata;
    const metadata = metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};

    await AuditLogService.logProductEvent({
      event_name: eventName,
      event_id: req.body?.event_id,
      occurred_at: req.body?.occurred_at,
      install_id: req.body?.install_id,
      session_id: req.body?.session_id,
      funnel_id: req.body?.funnel_id,
      tenant_id: req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      method: req.method,
      path: req.originalUrl,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      metadata: {
        source: String(metadata.source || "mobile").slice(0, 80),
        screen: String(metadata.screen || "").slice(0, 120) || null,
        platform: String(metadata.platform || "").slice(0, 20) || null,
        app_version: String(metadata.app_version || "").slice(0, 40) || null,
        billing_cycle: String(metadata.billing_cycle || "").slice(0, 20) || null,
      },
    });

    return res.status(202).json({ data: { accepted: true } });
  }
}
