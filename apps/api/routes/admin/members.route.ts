// Bu route dosyasi admin alanindaki members.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminMembersController } from "../../controllers/admin/members.controller";

export const adminMembersRoutes = Router();

adminMembersRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

// CRUD
adminMembersRoutes.get("/", AdminMembersController.list);
adminMembersRoutes.post("/", AdminMembersController.create);
adminMembersRoutes.get("/:id", AdminMembersController.getById);
adminMembersRoutes.put("/:id", AdminMembersController.update);
adminMembersRoutes.patch("/:id/status", AdminMembersController.setStatus);
adminMembersRoutes.delete("/:id", AdminMembersController.remove);

// Paket atama / hak yönetimi
adminMembersRoutes.post("/:memberId/packages", AdminMembersController.assignPackageToMember);
adminMembersRoutes.get("/:memberId/packages", AdminMembersController.listMemberPackages);
adminMembersRoutes.patch("/user-packages/:userPackageId/credits", AdminMembersController.adjustCredits);
adminMembersRoutes.delete("/user-packages/:userPackageId", AdminMembersController.removeUserPackage);

// Üye detay
adminMembersRoutes.get("/:memberId/attendance", AdminMembersController.getAttendanceHistory);
adminMembersRoutes.get("/:memberId/measurements", AdminMembersController.getMeasurements);
adminMembersRoutes.get("/:memberId/retention-score", AdminMembersController.getRetentionScore);
adminMembersRoutes.get("/:memberId/referrals", AdminMembersController.getReferrals);