// Bu route dosyasi admin alanindaki trainers.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminTrainersController } from "../../controllers/admin/trainers.controller";

export const adminTrainersRoutes = Router();

adminTrainersRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminTrainersRoutes.get("/", AdminTrainersController.list);
adminTrainersRoutes.post("/", AdminTrainersController.create);
adminTrainersRoutes.get("/:id", AdminTrainersController.getById);
adminTrainersRoutes.put("/:id", AdminTrainersController.update);
adminTrainersRoutes.patch("/:id/status", AdminTrainersController.setStatus);
adminTrainersRoutes.get("/:id/earnings", AdminTrainersController.earningsSummary);
adminTrainersRoutes.get("/:id/skills", AdminTrainersController.getSkills);
adminTrainersRoutes.put("/:id/skills", AdminTrainersController.setSkills);
adminTrainersRoutes.delete("/:id", AdminTrainersController.remove);
