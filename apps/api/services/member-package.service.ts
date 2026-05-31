import { IsNull } from "typeorm";
import { AppDataSource } from "../data-source";
import { Package } from "../entities/package.entity";
import { PackageTrainerAssignment } from "../entities/package-trainer-assignment.entity";
import { UserPackage } from "../entities/user-package.entity";
import { User, UserRole } from "../entities/user.entity";
import { AppError } from "../errors/AppError";

export class MemberPackageService {
  static async assignPackageToMember(input: {
    tenantId: string;
    memberId: string;
    packageId: string;
    startsAt?: string | Date | null;
    expiresAt?: string | Date | null;
  }) {
    const { tenantId, memberId, packageId } = input;

    return AppDataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(User);
      const packageRepo = manager.getRepository(Package);
      const userPackageRepo = manager.getRepository(UserPackage);

      const member = await memberRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: memberId,
          role: UserRole.MEMBER,
          deleted_at: IsNull(),
        },
      });

      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
      }

      const pkg = await packageRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: packageId,
          is_active: true,
        },
      });

      if (!pkg) {
        throw new AppError("PACKAGE_NOT_FOUND", 404, "Paket bulunamadı");
      }

      const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();

      if (Number.isNaN(startsAt.getTime())) {
        throw new AppError("VALIDATION_ERROR", 400, "starts_at geçersiz");
      }

      let expiresAt: Date | null = null;

      if (input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== "") {
        expiresAt = new Date(input.expiresAt);

        if (Number.isNaN(expiresAt.getTime())) {
          throw new AppError("VALIDATION_ERROR", 400, "expires_at geçersiz");
        }
      } else if (pkg.duration_days > 0) {
        expiresAt = new Date(startsAt);
        expiresAt.setDate(expiresAt.getDate() + pkg.duration_days);
      }

      if (expiresAt && expiresAt <= startsAt) {
        throw new AppError("VALIDATION_ERROR", 400, "expires_at starts_at tarihinden sonra olmalıdır");
      }

      const packageSnapshot = {
        id: pkg.id,
        title: pkg.title,
        type: pkg.type,
        total_credits: pkg.total_credits,
        duration_days: pkg.duration_days,
        capacity: pkg.capacity,
        display_price: pkg.display_price ?? null,
        rules: pkg.rules ?? {},
        assigned_at: new Date().toISOString(),
      };

      const userPackage = userPackageRepo.create({
        tenant_id: tenantId,
        user_id: memberId,
        package_id: pkg.id,
        remaining_credits: pkg.total_credits,
        starts_at: startsAt,
        expires_at: expiresAt ?? undefined,
        is_active: true,
        purchase_price: pkg.display_price ?? null,
        latest_package_price: pkg.display_price ?? null,
        package_snapshot: packageSnapshot,
      });

      await userPackageRepo.save(userPackage);

      return {
        userPackage,
        member,
        package: pkg,
      };
    });
  }

  static async listMemberPackages(input: {
    tenantId: string;
    memberId: string;
  }) {
    const { tenantId, memberId } = input;

    const member = await AppDataSource.getRepository(User).findOne({
      where: {
        tenant_id: tenantId,
        id: memberId,
        role: UserRole.MEMBER,
        deleted_at: IsNull(),
      },
    });

    if (!member) {
      throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
    }

    const rows = await AppDataSource.getRepository(UserPackage).find({
      where: {
        tenant_id: tenantId,
        user_id: memberId,
      },
      order: {
        created_at: "DESC",
      },
    });

    const packageIds = Array.from(new Set(rows.map((row) => row.package_id).filter(Boolean)));

    const packages = packageIds.length
      ? await AppDataSource.getRepository(Package).find({
          where: packageIds.map((id) => ({
            tenant_id: tenantId,
            id,
          })) as any,
        })
      : [];

    const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));

    const assignments = packageIds.length
      ? await AppDataSource.getRepository(PackageTrainerAssignment).find({
          where: packageIds.map((packageId) => ({
            tenant_id: tenantId,
            package_id: packageId,
            is_active: true,
          })) as any,
        })
      : [];

    const trainerIds = Array.from(new Set(assignments.map((row) => row.trainer_id).filter(Boolean)));

    const trainers = trainerIds.length
      ? await AppDataSource.getRepository(User).find({
          where: trainerIds.map((id) => ({
            tenant_id: tenantId,
            id,
            role: UserRole.TRAINER,
          })) as any,
          select: ["id", "first_name", "last_name", "email"],
        })
      : [];

    const trainerMap = new Map(
      trainers.map((trainer) => [
        trainer.id,
        {
          id: trainer.id,
          full_name: `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email,
          email: trainer.email,
        },
      ])
    );

    const assignmentsByPackage = new Map<string, Array<{ id: string; full_name: string; email: string }>>();

    for (const assignment of assignments) {
      const trainer = trainerMap.get(assignment.trainer_id);
      if (!trainer) continue;

      assignmentsByPackage.set(assignment.package_id, [
        ...(assignmentsByPackage.get(assignment.package_id) || []),
        trainer,
      ]);
    }

    const now = new Date();

    const data = rows.map((row) => {
      const isExpired = !!row.expires_at && row.expires_at <= now;
      const pkg = packageMap.get(row.package_id);
      const assignedTrainers = assignmentsByPackage.get(row.package_id) || [];

      return {
        ...row,
        is_expired: isExpired,
        package_title: pkg?.title ?? null,
        package_type: pkg?.type ?? null,
        package_total_credits: pkg?.total_credits ?? null,
        package_duration_days: pkg?.duration_days ?? null,
        package_price: pkg?.display_price ? Number(pkg.display_price) : null,
        assigned_trainers: assignedTrainers,
        trainer_summary: assignedTrainers.length
          ? assignedTrainers.map((trainer) => trainer.full_name).join(", ")
          : null,
      };
    });

    const totalRemainingCredits = data
      .filter((row) => row.is_active && !row.is_expired)
      .reduce((acc, row) => acc + row.remaining_credits, 0);

    return {
      data,
      totalRemainingCredits,
    };
  }

  static async adjustCredits(input: {
    tenantId: string;
    userPackageId: string;
    remainingCredits: number;
  }) {
    const { tenantId, userPackageId, remainingCredits } = input;

    if (!Number.isFinite(remainingCredits) || remainingCredits < 0) {
      throw new AppError("VALIDATION_ERROR", 400, "remaining_credits geçersiz");
    }

    const repo = AppDataSource.getRepository(UserPackage);

    const row = await repo.findOne({
      where: {
        tenant_id: tenantId,
        id: userPackageId,
      },
    });

    if (!row) {
      throw new AppError("USER_PACKAGE_NOT_FOUND", 404, "User package bulunamadı");
    }

    const oldState = {
      remaining_credits: row.remaining_credits,
    };

    row.remaining_credits = Math.floor(remainingCredits);

    await repo.save(row);

    return {
      row,
      oldState,
    };
  }

  static async deactivateUserPackage(input: {
    tenantId: string;
    userPackageId: string;
  }) {
    const { tenantId, userPackageId } = input;

    const repo = AppDataSource.getRepository(UserPackage);

    const row = await repo.findOne({
      where: {
        tenant_id: tenantId,
        id: userPackageId,
      },
    });

    if (!row) {
      throw new AppError("USER_PACKAGE_NOT_FOUND", 404, "User package bulunamadı");
    }

    const oldState = {
      is_active: row.is_active,
    };

    row.is_active = false;

    await repo.save(row);

    return {
      row,
      oldState,
    };
  }
}