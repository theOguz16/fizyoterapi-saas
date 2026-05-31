// Bu route dosyasi genel alanindaki public invites.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { PublicInvitesController } from "../controllers/public-invites.controller";
import { inviteAcceptRateLimit } from "../middlewares/rate-limit.middleware";

export const publicInvitesRoutes = Router();

publicInvitesRoutes.get("/:token/preview", PublicInvitesController.preview);
publicInvitesRoutes.post("/accept", inviteAcceptRateLimit, PublicInvitesController.accept);
