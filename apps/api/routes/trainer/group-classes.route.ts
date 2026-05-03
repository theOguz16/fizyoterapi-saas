import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerGroupClassesController } from "../../controllers/trainer/group-classes.controller";

export const trainerGroupClassesRoutes = Router();

trainerGroupClassesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerGroupClassesRoutes.get("/form-options", TrainerGroupClassesController.formOptions);
trainerGroupClassesRoutes.get("/", TrainerGroupClassesController.list);
trainerGroupClassesRoutes.post("/", TrainerGroupClassesController.create);
trainerGroupClassesRoutes.put("/:id", TrainerGroupClassesController.update);
trainerGroupClassesRoutes.delete("/:id", TrainerGroupClassesController.remove);
