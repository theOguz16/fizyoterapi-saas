// Bu route dosyasi admin alanindaki lead.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminLeadsController } from "../../controllers/admin/leads.controller";

export const adminLeadsRoutes = Router();

adminLeadsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminLeadsRoutes.get("/", AdminLeadsController.list);
adminLeadsRoutes.get("/:id", AdminLeadsController.getById);
adminLeadsRoutes.patch("/:id/status", AdminLeadsController.setStatus);
adminLeadsRoutes.delete("/:id", AdminLeadsController.remove);