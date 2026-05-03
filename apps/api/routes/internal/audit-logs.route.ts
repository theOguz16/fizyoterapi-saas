import { Router } from "express";
import { InternalAuditLogsController } from "../../controllers/internal/audit-logs.controller";
import { internalAdminMiddleware } from "../../middlewares/internal-admin.middleware";

export const internalAuditLogsRoutes = Router();

internalAuditLogsRoutes.use(internalAdminMiddleware);
internalAuditLogsRoutes.get("/", InternalAuditLogsController.list);
