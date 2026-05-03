// Bu route dosyasi admin alanindaki dashboard.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminDashboardController } from "../../controllers/admin/dashboard.controller";

export const adminDashboardRoutes = Router();

adminDashboardRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminDashboardRoutes.get("/", AdminDashboardController.get);
adminDashboardRoutes.get("/summary", AdminDashboardController.summary);
