// Bu route dosyasi member alanindaki measurement.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberMeasurementsController } from "../../controllers/member/measurements.controller";

export const memberMeasurementsRoutes = Router();

memberMeasurementsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberMeasurementsRoutes.post("/", MemberMeasurementsController.createMine);
memberMeasurementsRoutes.get("/", MemberMeasurementsController.listMine);
memberMeasurementsRoutes.get("/trend", MemberMeasurementsController.trendMine);
