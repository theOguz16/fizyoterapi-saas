// Bu route dosyasi admin alanindaki package trainers.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminPackageTrainersController } from "../../controllers/admin/package-trainers.controller";

export const adminPackageTrainersRoutes = Router();

adminPackageTrainersRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminPackageTrainersRoutes.get("/", AdminPackageTrainersController.list);
adminPackageTrainersRoutes.post("/", AdminPackageTrainersController.create);
adminPackageTrainersRoutes.delete("/:id", AdminPackageTrainersController.remove);
