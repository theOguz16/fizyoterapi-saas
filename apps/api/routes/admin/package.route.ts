// Bu route dosyasi admin alanindaki package.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminPackagesController } from "../../controllers/admin/packages.controller";

export const adminPackagesRoutes = Router();

adminPackagesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminPackagesRoutes.get("/", AdminPackagesController.list);
adminPackagesRoutes.get("/form-options", AdminPackagesController.formOptions);
adminPackagesRoutes.post("/", AdminPackagesController.create);
adminPackagesRoutes.get("/:id", AdminPackagesController.getById);
adminPackagesRoutes.put("/:id", AdminPackagesController.update);
adminPackagesRoutes.patch("/:id/status", AdminPackagesController.setStatus);
adminPackagesRoutes.delete("/:id", AdminPackagesController.remove);
