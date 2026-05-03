import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminCampaignsController } from "../../controllers/admin/campaigns.controller";

export const adminCampaignsRoutes = Router();

adminCampaignsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminCampaignsRoutes.get("/", AdminCampaignsController.list);
adminCampaignsRoutes.post("/", AdminCampaignsController.create);
adminCampaignsRoutes.get("/:id", AdminCampaignsController.getById);
adminCampaignsRoutes.patch("/:id", AdminCampaignsController.update);
