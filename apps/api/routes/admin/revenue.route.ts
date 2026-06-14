// Bu route planlanan admin gelir raporu API yuzeyini saglar.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminPaymentsController } from "../../controllers/admin/payments.controller";

export const adminRevenueRoutes = Router();

adminRevenueRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));
adminRevenueRoutes.get("/report", AdminPaymentsController.revenueReport);
adminRevenueRoutes.get("/export.csv", AdminPaymentsController.revenueExportCsv);
