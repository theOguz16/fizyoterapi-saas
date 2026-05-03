// routes/mobile/member-group-classes.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberGroupClassesController } from "../../controllers/mobile/member-group-classes.controller";

export const memberGroupClassesRoutes = Router();

memberGroupClassesRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));

memberGroupClassesRoutes.get("/", MemberGroupClassesController.list);
memberGroupClassesRoutes.post("/:id/join", MemberGroupClassesController.join);
memberGroupClassesRoutes.delete("/:id/leave", MemberGroupClassesController.leave);