// Bu route dosyasi trainer alanindaki members.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { TrainerMembersController } from "../../controllers/trainer/members.controller";

export const trainerMembersRoutes = Router();

trainerMembersRoutes.use(authMiddleware, tenantMiddleware, requireRole(["TRAINER"]));

trainerMembersRoutes.get("/", TrainerMembersController.list);
trainerMembersRoutes.get("/:id", TrainerMembersController.getById);
trainerMembersRoutes.get("/:id/attendance", TrainerMembersController.getAttendanceHistory);
trainerMembersRoutes.get("/:id/measurements", TrainerMembersController.getMeasurements);
trainerMembersRoutes.get("/:id/notes", TrainerMembersController.getNotes);
trainerMembersRoutes.get("/:id/notes/history", TrainerMembersController.getNoteHistory);
trainerMembersRoutes.post("/:id/notes", TrainerMembersController.createNote);
trainerMembersRoutes.put("/:id/notes", TrainerMembersController.updateNotes);
trainerMembersRoutes.patch("/:id/notes/:noteId", TrainerMembersController.updateNoteById);
trainerMembersRoutes.delete("/:id/notes/:noteId", TrainerMembersController.deleteNoteById);
