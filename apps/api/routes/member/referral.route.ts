// Bu route dosyasi member alanindaki referral.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberReferralsController } from "../../controllers/member/referrals.controller";

export const memberReferralsRoutes = Router();

memberReferralsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));

memberReferralsRoutes.get("/", MemberReferralsController.listMine);
memberReferralsRoutes.post("/", MemberReferralsController.createInvite);
