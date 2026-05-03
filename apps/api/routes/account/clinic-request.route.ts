// Bu route dosyasi account alanindaki clinic request.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { AccountClinicRequestController } from "../../controllers/account/clinic-request.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const accountClinicRequestRoutes = Router();

accountClinicRequestRoutes.use(authMiddleware);
accountClinicRequestRoutes.get("/", AccountClinicRequestController.mine);
accountClinicRequestRoutes.post("/", AccountClinicRequestController.createOrUpdate);
