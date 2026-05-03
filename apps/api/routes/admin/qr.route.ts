// Bu route dosyasi admin alanindaki qr.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminQrController } from "../../controllers/admin/qr.controller";

export const adminQrRoutes = Router();

adminQrRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminQrRoutes.post("/backfill", AdminQrController.backfill);
adminQrRoutes.post("/scan-entry", AdminQrController.scanSalonEntry);
