// Bu controller member tarafindaki qr.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Package } from "../../entities/package.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export class MemberQrController {
  private static async generateUniqueQrCode(tenantId: string) {
    const repo = AppDataSource.getRepository(User);
    for (let i = 0; i < 8; i += 1) {
      const code = `MEM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const exists = await repo.findOne({
        where: { tenant_id: tenantId, qr_code: code },
      });
      if (!exists) return code;
    }
    throw new AppError("QR_GENERATION_FAILED", 500, "QR kodu üretilemedi");
  }

  // --- GET /api/member/qr ---
  static async getMyQr(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.linkedUserId || req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const userRepo = AppDataSource.getRepository(User);
      const tenantRepo = AppDataSource.getRepository(Tenant);
      const member = await userRepo.findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
      }

      if (!member.qr_code) {
        member.qr_code = await MemberQrController.generateUniqueQrCode(tenantId);
        await userRepo.save(member);
      }

      const tenant = await tenantRepo.findOne({
        where: { id: tenantId },
        select: ["id", "name"],
      });

      const now = new Date();
      const packages = await AppDataSource.getRepository(UserPackage)
        .createQueryBuilder("up")
        .leftJoinAndMapOne("up.packageDetails", Package, "package", "up.package_id = package.id")
        .where("up.tenant_id = :tenantId", { tenantId })
        .andWhere("up.user_id = :memberId", { memberId: member.id })
        .andWhere("up.is_active = true")
        .andWhere("up.remaining_credits > 0")
        .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
        .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
        .orderBy("up.expires_at", "ASC", "NULLS LAST")
        .addOrderBy("up.created_at", "ASC")
        .getMany();

      return res.json({
        data: {
          member_id: member.id,
          qr_code: member.qr_code,
          salon_name: tenant?.name || null,
          full_name: `${member.first_name} ${member.last_name}`.trim(),
          email: member.email,
          active_packages: packages.map((row: any) => ({
            user_package_id: row.id,
            package_id: row.package_id,
            package_title: row.packageDetails?.title || "Paket",
            remaining_credits: row.remaining_credits,
            package_price: row.purchase_price || row.packageDetails?.display_price || null,
          })),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member QR get error:", error);
      throw new AppError("MEMBER_QR_GET_ERROR", 500, "QR bilgisi getirilemedi");
    }
  }
}
