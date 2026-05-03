// Bu route dosyasi admin alanindaki settings.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminSettingsController } from "../../controllers/admin/settings.controller";

export const adminSettingsRoutes = Router();

adminSettingsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminSettingsRoutes.get("/", AdminSettingsController.get);
adminSettingsRoutes.get("/notifications/logs", AdminSettingsController.notificationLogs);
adminSettingsRoutes.put("/", AdminSettingsController.update);
adminSettingsRoutes.post("/notifications/trigger", AdminSettingsController.triggerTemplate);
