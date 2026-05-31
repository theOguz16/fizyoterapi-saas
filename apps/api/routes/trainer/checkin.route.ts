// Bu route dosyasi trainer alanindaki checkin.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { checkinRateLimit } from "../../middlewares/rate-limit.middleware";
import { TrainerCheckinController } from "../../controllers/trainer/checkin.controller";

export const trainerCheckinRoutes = Router();

trainerCheckinRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerCheckinRoutes.get("/logs", TrainerCheckinController.listLogs);
trainerCheckinRoutes.post("/qr", checkinRateLimit, TrainerCheckinController.checkinByQr);
trainerCheckinRoutes.post("/manual", checkinRateLimit, TrainerCheckinController.checkinManual);
