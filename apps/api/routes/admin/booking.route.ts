// Bu route dosyasi admin alanindaki booking.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminBookingsController } from "../../controllers/admin/bookings.controller";

export const adminBookingsRoutes = Router();

adminBookingsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminBookingsRoutes.get("/", AdminBookingsController.list);
adminBookingsRoutes.post("/", AdminBookingsController.create);
adminBookingsRoutes.get("/:id", AdminBookingsController.getById);
adminBookingsRoutes.put("/:id", AdminBookingsController.update);
adminBookingsRoutes.patch("/:id/reschedule", AdminBookingsController.reschedule);
adminBookingsRoutes.patch("/:id/status", AdminBookingsController.setStatus);
