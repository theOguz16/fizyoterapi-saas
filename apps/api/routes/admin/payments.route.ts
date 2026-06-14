// Bu route dosyasi admin alanindaki payments.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminPaymentsController } from "../../controllers/admin/payments.controller";

export const adminPaymentsRoutes = Router();

adminPaymentsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminPaymentsRoutes.get("/revenue/report", AdminPaymentsController.revenueReport);
adminPaymentsRoutes.get("/revenue/export.csv", AdminPaymentsController.revenueExportCsv);
adminPaymentsRoutes.get("/requests", AdminPaymentsController.listRequests);
adminPaymentsRoutes.patch("/requests/:bookingId/approve", AdminPaymentsController.approveRequest);
adminPaymentsRoutes.patch("/requests/:bookingId/reject", AdminPaymentsController.rejectRequest);
