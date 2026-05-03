// Bu route dosyasi admin alanindaki invites.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminInvitesController } from "../../controllers/admin/invites.controller";

export const adminInvitesRoutes = Router();

adminInvitesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminInvitesRoutes.get("/", AdminInvitesController.list);
adminInvitesRoutes.post("/", AdminInvitesController.create);
adminInvitesRoutes.patch("/:id/cancel", AdminInvitesController.cancel);
