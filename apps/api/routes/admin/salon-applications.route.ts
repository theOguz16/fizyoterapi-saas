// Bu route dosyasi admin alanindaki salon applications.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminSalonApplicationsController } from "../../controllers/admin/salon-applications.controller";

export const adminSalonApplicationsRoutes = Router();
adminSalonApplicationsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminSalonApplicationsRoutes.get("/", AdminSalonApplicationsController.list);
adminSalonApplicationsRoutes.patch("/:id/payment-verify", AdminSalonApplicationsController.verifyPayment);
adminSalonApplicationsRoutes.patch("/:id/approve", AdminSalonApplicationsController.approve);
adminSalonApplicationsRoutes.patch("/:id/reject", AdminSalonApplicationsController.reject);
