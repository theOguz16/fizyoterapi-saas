// Bu route dosyasi genel alanindaki public.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { PublicController } from "../controllers/public.controller";

export const publicRoutes = Router();

publicRoutes.get("/cities", PublicController.listCities);
publicRoutes.get("/salons", PublicController.listSalons);
publicRoutes.get("/salons/:slug", PublicController.getSalonPublicPage);
publicRoutes.get("/salons/:slug/packages", PublicController.getSalonPublicPackages);
publicRoutes.get("/salons/:slug/day-options", PublicController.getSalonDayOptions);
publicRoutes.get("/salons/:slug/trainers", PublicController.getSalonTrainerOptions);
publicRoutes.post("/discovery-profile", PublicController.createDiscoveryProfile);
publicRoutes.post("/clinic-recommendations", PublicController.getClinicRecommendations);
publicRoutes.post("/plan-recommendation", PublicController.getPlanRecommendation);
publicRoutes.post("/clinic-intake", PublicController.createClinicIntake);
publicRoutes.post("/salons/:slug/leads", PublicController.createLead);
