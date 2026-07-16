import { Router } from "express";
import { CalendarController } from "../controllers/calendar.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";

export const calendarRoutes = Router();

calendarRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN", "TRAINER", "MEMBER"]));
calendarRoutes.get("/feed", CalendarController.feed);
