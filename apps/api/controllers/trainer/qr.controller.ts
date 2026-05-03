// Bu controller trainer tarafindaki qr.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { User, UserRole } from "../../entities/user.entity";

export class TrainerQrController {
  private static async generateUniqueQrCode(tenantId: string) {
    const repo = AppDataSource.getRepository(User);
    for (let i = 0; i < 8; i += 1) {
      const code = `TRN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const exists = await repo.findOne({ where: { tenant_id: tenantId, qr_code: code } });
      if (!exists) return code;
    }
    throw new AppError("QR_GENERATION_FAILED", 500, "QR kodu üretilemedi");
  }

  // --- GET /api/trainer/qr ---
  static async getMyQr(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.linkedUserId || req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const repo = AppDataSource.getRepository(User);
      const trainer = await repo.findOne({
        where: { tenant_id: tenantId, id: trainerId, role: UserRole.TRAINER },
      });
      if (!trainer) {
        throw new AppError("TRAINER_NOT_FOUND", 404, "Egitmen bulunamadi");
      }

      if (!trainer.qr_code) {
        trainer.qr_code = await TrainerQrController.generateUniqueQrCode(tenantId);
        await repo.save(trainer);
      }

      return res.json({
        data: {
          trainer_id: trainer.id,
          full_name: `${trainer.first_name} ${trainer.last_name}`.trim(),
          email: trainer.email,
          qr_code: trainer.qr_code,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer QR get error:", error);
      throw new AppError("TRAINER_QR_GET_ERROR", 500, "Trainer QR bilgisi getirilemedi");
    }
  }
}
