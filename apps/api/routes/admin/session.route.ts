// Bu route dosyasi admin alanindaki session.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminSessionsController } from "../../controllers/admin/sessions.controller";

export const adminSessionsRoutes = Router();

adminSessionsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminSessionsRoutes.get("/", AdminSessionsController.list);
adminSessionsRoutes.post("/", AdminSessionsController.create);
adminSessionsRoutes.get("/:id", AdminSessionsController.getById);
adminSessionsRoutes.put("/:id", AdminSessionsController.update);
adminSessionsRoutes.patch("/:id/status", AdminSessionsController.setStatus);
adminSessionsRoutes.delete("/:id", AdminSessionsController.remove);
adminSessionsRoutes.get("/:id/attendees", AdminSessionsController.getAttendees);