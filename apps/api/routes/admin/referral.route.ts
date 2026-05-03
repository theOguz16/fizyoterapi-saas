// Bu route dosyasi admin alanindaki referral.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminReferralsController } from "../../controllers/admin/referral.controller";

export const adminReferralsRoutes = Router();

adminReferralsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminReferralsRoutes.get("/", AdminReferralsController.list);
adminReferralsRoutes.get("/rewards/list", AdminReferralsController.listRewards);
adminReferralsRoutes.post("/:id/grant-reward", AdminReferralsController.grantReward);
adminReferralsRoutes.get("/:id", AdminReferralsController.getById);
