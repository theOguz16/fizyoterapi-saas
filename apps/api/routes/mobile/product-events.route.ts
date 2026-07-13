import { Router } from "express";
import { MobileProductEventsController } from "../../controllers/mobile/product-events.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { productEventRateLimit } from "../../middlewares/rate-limit.middleware";

export const mobileProductEventsRoutes = Router();

mobileProductEventsRoutes.use(productEventRateLimit, authMiddleware);
mobileProductEventsRoutes.post("/", MobileProductEventsController.track);
