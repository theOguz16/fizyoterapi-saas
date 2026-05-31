import { Router } from "express";
import { activeAccountMiddleware } from "../../middlewares/active-account.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberRealtimeController } from "../../controllers/member/realtime.controller";

export const memberRealtimeRoutes = Router();

memberRealtimeRoutes.use(authMiddleware, activeAccountMiddleware, requireRole(["MEMBER"]));

memberRealtimeRoutes.get("/stream", MemberRealtimeController.stream);
