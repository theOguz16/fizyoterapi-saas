// Bu route dosyasi mobile alanindaki devices.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { MobileDevicesController } from "../../controllers/mobile/devices.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

export const mobileDevicesRoutes = Router();

mobileDevicesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN", "TRAINER", "MEMBER"]));
mobileDevicesRoutes.post("/register", MobileDevicesController.register);
mobileDevicesRoutes.delete("/:token", MobileDevicesController.unregister);
