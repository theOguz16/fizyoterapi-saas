// Bu controller mobile tarafindaki devices.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { DevicePlatform, DeviceToken } from "../../entities/device-token.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const ALLOWED_PLATFORMS = new Set<string>(Object.values(DevicePlatform));

export class MobileDevicesController {
  private static normalizePlatform(raw: unknown): DevicePlatform {
    const value = String(raw ?? "").trim().toUpperCase();
    if (!ALLOWED_PLATFORMS.has(value)) {
      throw new AppError("VALIDATION_ERROR", 400, "platform alanı IOS veya ANDROID olmalıdır");
    }
    return value as DevicePlatform;
  }

  // --- POST /api/mobile/devices/register ---
  static async register(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const userId = req.auth?.sub;
      if (!tenantId || !userId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const token = String(req.body?.token ?? "").trim();
      const platform = MobileDevicesController.normalizePlatform(req.body?.platform);
      if (!token) {
        throw new AppError("VALIDATION_ERROR", 400, "token alanı zorunludur");
      }

      const repo = AppDataSource.getRepository(DeviceToken);
      let row = await repo.findOne({ where: { token } });
      if (!row) {
        row = repo.create({
          tenant_id: tenantId,
          member_id: userId,
          token,
          platform,
          is_active: true,
          last_seen_at: new Date(),
        });
      } else {
        row.tenant_id = tenantId;
        row.member_id = userId;
        row.platform = platform;
        row.is_active = true;
        row.last_seen_at = new Date();
      }

      await repo.save(row);
      return res.status(201).json({
        data: {
          id: row.id,
          token: row.token,
          platform: row.platform,
          is_active: row.is_active,
          last_seen_at: row.last_seen_at,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Mobile register device error:", error);
      throw new AppError("MOBILE_DEVICE_REGISTER_ERROR", 500, "Mobil cihaz kaydı tamamlanamadı");
    }
  }

  // --- DELETE /api/mobile/devices/:token ---
  static async unregister(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const userId = req.auth?.sub;
      if (!tenantId || !userId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const token = decodeURIComponent(String(req.params.token ?? "")).trim();
      if (!token) {
        throw new AppError("VALIDATION_ERROR", 400, "token parametresi zorunludur");
      }

      const repo = AppDataSource.getRepository(DeviceToken);
      const row = await repo.findOne({
        where: { tenant_id: tenantId, member_id: userId, token },
      });
      if (!row) {
        return res.json({ data: { removed: false } });
      }

      row.is_active = false;
      row.last_seen_at = new Date();
      await repo.save(row);

      return res.json({ data: { removed: true } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Mobile unregister device error:", error);
      throw new AppError("MOBILE_DEVICE_UNREGISTER_ERROR", 500, "Mobil cihaz kaydı kaldırılamadı");
    }
  }
}
