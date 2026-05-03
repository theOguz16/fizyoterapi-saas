// Bu route dosyasi member alanindaki qr.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberQrController } from "../../controllers/member/qr.controller";

export const memberQrRoutes = Router();

memberQrRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberQrRoutes.get("/", MemberQrController.getMyQr);