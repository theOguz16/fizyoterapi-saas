// Bu route dosyasi member alanindaki booking.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberBookingsController } from "../../controllers/member/bookings.controller";

export const memberBookingsRoutes = Router();

memberBookingsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));

memberBookingsRoutes.get("/", MemberBookingsController.list);
memberBookingsRoutes.get("/:id", MemberBookingsController.getById);
memberBookingsRoutes.patch("/:id/cancel", MemberBookingsController.cancel);
