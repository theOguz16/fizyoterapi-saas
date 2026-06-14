// Bu route mobil bildirim tercihlerini auth'lu tum roller icin acar.
import { Router } from "express";
import { MobileNotificationPreferencesController } from "../../controllers/mobile/notification-preferences.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

export const mobileNotificationPreferencesRoutes = Router();

mobileNotificationPreferencesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN", "TRAINER", "MEMBER"]));
mobileNotificationPreferencesRoutes.get("/", MobileNotificationPreferencesController.getMine);
mobileNotificationPreferencesRoutes.put("/", MobileNotificationPreferencesController.updateMine);
