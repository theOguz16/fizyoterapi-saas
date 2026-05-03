// Bu route dosyasi member alanindaki home.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberHomeController } from "../../controllers/member/home.controller";

export const memberHomeRoutes = Router();

memberHomeRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberHomeRoutes.get("/", MemberHomeController.get);
memberHomeRoutes.patch("/weekly-class-hours", MemberHomeController.setWeeklyClassHours);
