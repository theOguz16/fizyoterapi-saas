// Bu route dosyasi member alanindaki availability.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberAvailabilityController } from "../../controllers/member/availability.controller";

export const memberAvailabilityRoutes = Router();

memberAvailabilityRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));

memberAvailabilityRoutes.get("/", MemberAvailabilityController.list);
memberAvailabilityRoutes.post("/", MemberAvailabilityController.create);
memberAvailabilityRoutes.delete("/:id", MemberAvailabilityController.remove);