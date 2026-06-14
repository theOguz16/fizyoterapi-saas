// Bu route dosyasi admin alanindaki clinic.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminClinicController } from "../../controllers/admin/clinic.controller";

export const adminClinicRoutes = Router();

adminClinicRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminClinicRoutes.get("/qr", AdminClinicController.getClinicQr);
adminClinicRoutes.get("/subscription", AdminClinicController.getSubscription);
adminClinicRoutes.get("/subscription/history", AdminClinicController.getSubscriptionHistory);
adminClinicRoutes.post("/subscription/start-trial", AdminClinicController.startTrial);
