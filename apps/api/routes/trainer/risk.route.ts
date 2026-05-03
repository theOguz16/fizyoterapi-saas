// Bu route dosyasi trainer alanindaki risk.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerRiskController } from "../../controllers/trainer/risk.controller";

export const trainerRiskRoutes = Router();

trainerRiskRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerRiskRoutes.get("/members", TrainerRiskController.listRiskMembers);
trainerRiskRoutes.get("/members/:memberId", TrainerRiskController.getMemberRiskDetail);