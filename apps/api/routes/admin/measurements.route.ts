// Bu route dosyasi admin alanindaki measurements.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminMeasurementsController } from "../../controllers/admin/measurements.controller";

export const adminMeasurementsRoutes = Router();

adminMeasurementsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminMeasurementsRoutes.get("/", AdminMeasurementsController.list); // ?memberId=
adminMeasurementsRoutes.get("/trend", AdminMeasurementsController.trend); // ?memberId=
adminMeasurementsRoutes.get("/due", AdminMeasurementsController.dueList);
adminMeasurementsRoutes.post("/due/reminder-mock", AdminMeasurementsController.sendDueRemindersMock);
adminMeasurementsRoutes.post("/", AdminMeasurementsController.create);
adminMeasurementsRoutes.delete("/:id", AdminMeasurementsController.remove);
