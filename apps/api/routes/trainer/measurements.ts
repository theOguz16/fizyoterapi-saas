// Bu route dosyasi trainer alanindaki measurements endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerMeasurementsController } from "../../controllers/trainer/measurements.controller";

export const trainerMeasurementsRoutes = Router();

trainerMeasurementsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerMeasurementsRoutes.get("/", TrainerMeasurementsController.list); // ?memberId=
trainerMeasurementsRoutes.get("/trend", TrainerMeasurementsController.trend); // ?memberId=
trainerMeasurementsRoutes.get("/due", TrainerMeasurementsController.dueList); // ?thresholdDays=
trainerMeasurementsRoutes.post("/", TrainerMeasurementsController.forbiddenMutation);
trainerMeasurementsRoutes.put("/:id", TrainerMeasurementsController.forbiddenMutation);
trainerMeasurementsRoutes.delete("/:id", TrainerMeasurementsController.forbiddenMutation);
