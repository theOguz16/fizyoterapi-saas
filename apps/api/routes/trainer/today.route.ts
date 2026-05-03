// Bu route dosyasi trainer alanindaki today.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerTodayController } from "../../controllers/trainer/today.controller";

export const trainerTodayRoutes = Router();

trainerTodayRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));
trainerTodayRoutes.get("/", TrainerTodayController.get);