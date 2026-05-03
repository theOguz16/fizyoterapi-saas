// Bu route dosyasi member alanindaki attendance.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { MemberAttendanceController } from "../../controllers/member/attendance.controller";

export const memberAttendanceRoutes = Router();

memberAttendanceRoutes.use(authMiddleware, tenantMiddleware, requireRole(["MEMBER"]));
memberAttendanceRoutes.get("/history", MemberAttendanceController.history);