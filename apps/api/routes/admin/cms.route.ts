// Bu route dosyasi admin alanindaki cms.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AdminCmsController } from "../../controllers/admin/cms.controller";
import { upload } from "../../middlewares/upload.middleware";


export const adminCmsRoutes = Router();
const wrap =
  (handler: (req: any, res: any) => Promise<any>) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(handler(req, res)).catch(next);

adminCmsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["ADMIN"]));

adminCmsRoutes.get("/profile", wrap(AdminCmsController.getProfile));
adminCmsRoutes.put("/profile", wrap(AdminCmsController.updateProfile));

adminCmsRoutes.post("/images", upload.single("file"), wrap(AdminCmsController.uploadImage));
adminCmsRoutes.delete("/images/:imageId", wrap(AdminCmsController.deleteImage));

adminCmsRoutes.get("/preview", wrap(AdminCmsController.preview));
adminCmsRoutes.post("/publish", wrap(AdminCmsController.publish));
adminCmsRoutes.post("/unpublish", wrap(AdminCmsController.unpublish));
