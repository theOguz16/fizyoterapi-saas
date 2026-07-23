// Bu route dosyasi trainer alanindaki booking.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerBookingsController } from "../../controllers/trainer/bookings.controller";

export const trainerBookingsRoutes = Router();

trainerBookingsRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerBookingsRoutes.get("/availabilities", TrainerBookingsController.listAvailabilities);
trainerBookingsRoutes.get("/form-options", TrainerBookingsController.formOptions);
trainerBookingsRoutes.get("/schedule-change-requests", TrainerBookingsController.listScheduleChangeRequests);
trainerBookingsRoutes.post("/bulk-notifications", TrainerBookingsController.sendBulkNotification);
trainerBookingsRoutes.get("/", TrainerBookingsController.list);
trainerBookingsRoutes.post("/:id/schedule-change-request", TrainerBookingsController.createScheduleChangeRequest);
trainerBookingsRoutes.patch("/:id/no-show", TrainerBookingsController.markNoShow);
trainerBookingsRoutes.get("/:id", TrainerBookingsController.getById);
trainerBookingsRoutes.patch("/:id/reschedule", TrainerBookingsController.reschedule);
trainerBookingsRoutes.patch("/:id/status", TrainerBookingsController.setStatus);
trainerBookingsRoutes.post("/", TrainerBookingsController.createSlotOrBooking);
