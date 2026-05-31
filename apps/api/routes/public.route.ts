// Bu route dosyasi genel alanindaki public.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { PublicController } from "../controllers/public.controller";
import { publicFormRateLimit, publicRecommendationRateLimit } from "../middlewares/rate-limit.middleware";

export const publicRoutes = Router();

publicRoutes.get("/cities", PublicController.listCities);
publicRoutes.get("/salons", PublicController.listSalons);
publicRoutes.get("/salons/:slug", PublicController.getSalonPublicPage);
publicRoutes.get("/salons/:slug/packages", PublicController.getSalonPublicPackages);
publicRoutes.get("/salons/:slug/day-options", PublicController.getSalonDayOptions);
publicRoutes.get("/salons/:slug/trainers", PublicController.getSalonTrainerOptions);
publicRoutes.post("/discovery-profile", publicRecommendationRateLimit, PublicController.createDiscoveryProfile);
publicRoutes.post("/clinic-recommendations", publicRecommendationRateLimit, PublicController.getClinicRecommendations);
publicRoutes.post("/plan-recommendation", publicRecommendationRateLimit, PublicController.getPlanRecommendation);
publicRoutes.post("/clinic-intake", publicFormRateLimit, PublicController.createClinicIntake);
publicRoutes.post("/demo-leads", publicFormRateLimit, PublicController.createDemoLead);
publicRoutes.post("/salons/:slug/leads", publicFormRateLimit, PublicController.createLead);
publicRoutes.post("/salons/:slug/events", publicRecommendationRateLimit, PublicController.trackSalonEvent);
