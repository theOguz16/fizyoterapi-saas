// Bu route dosyasi member alanindaki salon applications.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { activeAccountMiddleware } from "../../middlewares/active-account.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberSalonApplicationsController } from "../../controllers/member/salon-applications.controller";

export const memberSalonApplicationsRoutes = Router();
memberSalonApplicationsRoutes.use(authMiddleware, activeAccountMiddleware, requireRole(["MEMBER"]));
memberSalonApplicationsRoutes.get("/me", MemberSalonApplicationsController.mine);
memberSalonApplicationsRoutes.post("/", MemberSalonApplicationsController.create);
memberSalonApplicationsRoutes.post("/leave", MemberSalonApplicationsController.leave);
