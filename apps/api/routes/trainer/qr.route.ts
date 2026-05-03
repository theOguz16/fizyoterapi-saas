// Bu route dosyasi trainer alanindaki qr.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerQrController } from "../../controllers/trainer/qr.controller";

export const trainerQrRoutes = Router();

trainerQrRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));
trainerQrRoutes.get("/", TrainerQrController.getMyQr);
