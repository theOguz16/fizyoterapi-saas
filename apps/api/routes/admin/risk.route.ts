// Bu route dosyasi admin alanindaki risk.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminRiskController } from "../../controllers/admin/risk.controller";

export const adminRiskRoutes = Router();

adminRiskRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminRiskRoutes.get("/members", AdminRiskController.listRiskMembers);
adminRiskRoutes.get("/members/:memberId", AdminRiskController.getMemberRiskDetail);
adminRiskRoutes.post("/recalculate", AdminRiskController.recalculate);
adminRiskRoutes.post("/notifications/trigger", AdminRiskController.triggerNotifications);
adminRiskRoutes.get("/notifications/logs", AdminRiskController.notificationLogs);
