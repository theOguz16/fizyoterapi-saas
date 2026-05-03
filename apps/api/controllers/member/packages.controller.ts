// Bu controller member tarafindaki packages.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Package } from "../../entities/package.entity";
import { UserPackage } from "../../entities/user-package.entity"; 
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

function pricesDiffer(previous: unknown, current: unknown) {
  if (previous === null || previous === undefined) return false;
  const prevNumber = Number(previous);
  const currentNumber = Number(current);
  if (Number.isFinite(prevNumber) && Number.isFinite(currentNumber)) {
    return prevNumber !== currentNumber;
  }
  return String(previous) !== String(current ?? "");
}

export class MemberPackagesController {
  
  // --- GET /api/member/packages ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadi");
      }

      const rows = await AppDataSource.getRepository(Package).find({
        where: {
          tenant_id: tenantId,
          is_active: true,
          is_visible: true,
        },
        order: { created_at: "DESC" },
      });

      return res.json({
        data: rows.map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          total_credits: row.total_credits,
          duration_days: row.duration_days,
          capacity: row.capacity,
          display_price: row.display_price ?? null,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member packages list error:", error);
      throw new AppError("MEMBER_PACKAGES_LIST_ERROR", 500, "Paketler getirilemedi");
    }
  }

  // --- GET /api/member/packages/my-packages ---
  static async listMyPackages(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const userId = req.auth?.linkedUserId || req.auth?.sub; 

      if (!tenantId || !userId) {
        throw new AppError("BAD_REQUEST", 400, "Tenant veya üye bilgisi eksik");
      }

      const rows = await AppDataSource.getRepository(UserPackage)
        .createQueryBuilder("userPackage")
        .leftJoinAndMapOne(
          "userPackage.packageDetails",
          Package,
          "package",
          "userPackage.package_id = package.id"
        )
        .where("userPackage.tenant_id = :tenantId", { tenantId })
        .andWhere("userPackage.user_id = :userId", { userId })
        .orderBy("userPackage.created_at", "DESC")
        .getMany();

      const now = new Date();

      return res.json({
        data: rows.map((row: any) => {
          const startsAt = row.starts_at || row.created_at || null;
          const expiresAt = row.expires_at || null;
          const isUpcoming = startsAt ? new Date(startsAt).getTime() > now.getTime() : false;
          const isExpired = expiresAt ? new Date(expiresAt).getTime() < now.getTime() : false;
          const status = isUpcoming ? "UPCOMING" : row.is_active && !isExpired ? "ACTIVE" : "EXPIRED";

          return {
            id: row.id,
            package_id: row.package_id,
            package_title: row.packageDetails?.title || "İsimsiz Paket",
            lesson_category_label: row.packageDetails?.type || "Genel Ders",
            package_price: row.purchase_price || row.packageDetails?.display_price || null,
            latest_catalog_price: row.packageDetails?.display_price || row.latest_package_price || null,
            renewal_price: row.packageDetails?.display_price || row.latest_package_price || row.purchase_price || null,
            renewal_price_changed: pricesDiffer(
              row.purchase_price,
              row.packageDetails?.display_price || row.latest_package_price || row.purchase_price || null
            ),
            total_credits: row.packageDetails?.total_credits || 0,
            package_total_credits: row.packageDetails?.total_credits || 0,
            remaining_credits: row.remaining_credits,
            status,
            starts_at: startsAt,
            expires_at: expiresAt,
            created_at: row.created_at,
            source_request_id: row.source_request_id || null,
            package_snapshot: row.package_snapshot || {},
          };
        }),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member my-packages list error:", error);
      throw new AppError("MEMBER_MY_PACKAGES_LIST_ERROR", 500, "Sahip olunan paketler getirilemedi");
    }
  }
}
