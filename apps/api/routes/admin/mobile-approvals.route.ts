// Bu route dosyasi admin alanindaki mobile approvals.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminMobileApprovalsController } from "../../controllers/admin/mobile-approvals.controller";

export const adminMobileApprovalsRoutes = Router();

adminMobileApprovalsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminMobileApprovalsRoutes.get("/", AdminMobileApprovalsController.list);
adminMobileApprovalsRoutes.patch("/:id", AdminMobileApprovalsController.decide);
