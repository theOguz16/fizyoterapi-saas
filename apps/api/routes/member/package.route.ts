// Bu route dosyasi member alanindaki package.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberPackagesController } from "../../controllers/member/packages.controller";

export const memberPackagesRoutes = Router();

memberPackagesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberPackagesRoutes.get("/", MemberPackagesController.list);
memberPackagesRoutes.get("/my-packages", MemberPackagesController.listMyPackages);

