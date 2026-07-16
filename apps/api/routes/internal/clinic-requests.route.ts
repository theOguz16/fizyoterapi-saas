// Bu route dosyasi internal alanindaki clinic requests.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { InternalClinicRequestsController } from "../../controllers/internal/clinic-requests.controller";
import { internalAdminMiddleware } from "../../middlewares/internal-admin.middleware";

export const internalClinicRequestsRoutes = Router();

internalClinicRequestsRoutes.use(internalAdminMiddleware);
internalClinicRequestsRoutes.get("/", InternalClinicRequestsController.list);
internalClinicRequestsRoutes.get("/demo-leads", InternalClinicRequestsController.listDemoLeads);
internalClinicRequestsRoutes.delete("/demo-leads/:id", InternalClinicRequestsController.hardDeleteDemoLead);
internalClinicRequestsRoutes.patch("/:id/publish", InternalClinicRequestsController.publish);
internalClinicRequestsRoutes.patch("/:id/reject", InternalClinicRequestsController.reject);
internalClinicRequestsRoutes.patch("/:id/activate", InternalClinicRequestsController.activate);
internalClinicRequestsRoutes.patch("/:id/boost", InternalClinicRequestsController.boost);
