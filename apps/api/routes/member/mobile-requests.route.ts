// Bu route dosyasi member alanindaki mobile requests.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberMobileRequestsController } from "../../controllers/member/mobile-requests.controller";

export const memberMobileRequestsRoutes = Router();

memberMobileRequestsRoutes.use("/purchase-requests", authMiddleware, requireRole(["MEMBER"]));
memberMobileRequestsRoutes.post("/purchase-requests", MemberMobileRequestsController.createPaymentRequest);
memberMobileRequestsRoutes.get("/purchase-requests", MemberMobileRequestsController.listPaymentRequests);

memberMobileRequestsRoutes.use("/change-requests", authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberMobileRequestsRoutes.post("/change-requests", MemberMobileRequestsController.createChangeRequest);
memberMobileRequestsRoutes.get("/change-requests", MemberMobileRequestsController.listChangeRequests);
