import { Response } from "express";
import type { CalendarFeedRole } from "@fitnes-saas/contracts";
import { AppError } from "../errors/AppError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { CalendarFeedService } from "../services/calendar-feed.service";

export class CalendarController {
  static async feed(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const actorUserId = req.auth?.linkedUserId || req.auth?.sub;
    const role = String(req.auth?.role || "") as CalendarFeedRole;
    if (!tenantId || !actorUserId || !["ADMIN", "TRAINER", "MEMBER"].includes(role)) {
      throw new AppError("CALENDAR_SCOPE_INVALID", 403, "Takvim rol veya klinik bağlamı geçersiz");
    }
    const requested = CalendarFeedService.parseRange(req.query);
    const feed = await CalendarFeedService.getFeed({ tenantId, actorUserId, role, ...requested });
    return res.json({ data: feed });
  }
}
