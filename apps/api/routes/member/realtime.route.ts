import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberRealtimeController } from "../../controllers/member/realtime.controller";

export const memberRealtimeRoutes = Router();

memberRealtimeRoutes.use(authMiddleware, requireRole(["MEMBER"]));

memberRealtimeRoutes.get("/stream", MemberRealtimeController.stream);
