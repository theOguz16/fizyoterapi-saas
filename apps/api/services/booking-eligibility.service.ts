// Bu servis modulu backend tarafinda booking eligibility.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { AppError } from "../errors/AppError";
import { LessonCategory } from "../entities/class-session.entity";
import { Package } from "../entities/package.entity";
import { PackageTrainerAssignment } from "../entities/package-trainer-assignment.entity";
import { TrainerSkill } from "../entities/trainer-skill.entity";
import { UserPackage } from "../entities/user-package.entity";

type EligibilityParams = {
  tenantId: string;
  trainerId: string;
  memberId: string;
  packageId: string;
};

// Rezervasyon olusmadan once "uye bu paketi alabilir mi, egitmen bunu verebilir mi"
// sorularini merkezi olarak cevaplar.
export class BookingEligibilityService {
  static normalizeLessonCategory(raw: unknown): LessonCategory | null {
    const value = String(raw ?? "").trim().toUpperCase();
    if (!value) return null;
    if (value === "GROUP" || value === "GRUP") return LessonCategory.GRUP;
    if (value === "PT") return LessonCategory.PT;
    if (value === "SCOLIOSIS" || value === "SKOLYOZ") return LessonCategory.SKOLYOZ;
    if (value === "PILATES") return LessonCategory.PILATES;
    if (value === "REFORMER") return LessonCategory.REFORMER;
    return null;
  }

  static async getActiveMemberPackageIds(tenantId: string, memberIds: string[]) {
    if (memberIds.length === 0) return new Map<string, Set<string>>();

    const now = new Date();
    const rows = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id IN (:...memberIds)", { memberIds })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
      .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
      .getMany();

    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const current = map.get(row.user_id) ?? new Set<string>();
      current.add(row.package_id);
      map.set(row.user_id, current);
    }
    return map;
  }

  static async getActiveTrainerAssignmentPackageIds(tenantId: string, trainerId: string) {
    const rows = await AppDataSource.getRepository(PackageTrainerAssignment).find({
      where: { tenant_id: tenantId, trainer_id: trainerId, is_active: true },
      select: ["package_id"],
      order: { created_at: "DESC" },
    });
    return Array.from(new Set(rows.map((row) => row.package_id)));
  }

  static buildMemberBookablePackageMap(
    memberIds: string[],
    memberActivePackages: Map<string, Set<string>>,
    trainerAssignedPackageIds: string[],
    options?: {
      packageLessonCategoryMap?: Record<string, LessonCategory | null>;
      trainerSkillSet?: Set<LessonCategory>;
    }
  ) {
    // Admin ve takvim ekranlarinda toplu gorunum gerektigi icin
    // her uye icin uygun paket kesisimi bir kerede hesaplanir.
    const trainerSet = new Set(trainerAssignedPackageIds);
    const memberActivePackageIds: Record<string, string[]> = {};
    const memberBookablePackageIds: Record<string, string[]> = {};
    const memberPackageDiagnostics: Record<
      string,
      {
        active_member_packages: string[];
        trainer_assigned_packages: string[];
        intersection_packages: string[];
        reason_codes: string[];
      }
    > = {};
    const packageLessonCategoryMap = options?.packageLessonCategoryMap || {};
    const trainerSkillSet = options?.trainerSkillSet;

    for (const memberId of memberIds) {
      const activeIds = Array.from(memberActivePackages.get(memberId) ?? []);
      memberActivePackageIds[memberId] = activeIds;
      const intersection = activeIds.filter((id) => trainerSet.has(id));
      const skillFiltered = intersection.filter((id) => {
        if (!trainerSkillSet || trainerSkillSet.size === 0) return true;
        const category = packageLessonCategoryMap[id];
        if (!category) return false;
        return trainerSkillSet.has(category);
      });
      memberBookablePackageIds[memberId] = skillFiltered;

      const reasonCodes: string[] = [];
      if (activeIds.length === 0) {
        reasonCodes.push("NO_MEMBER_ACTIVE_PACKAGE");
      }
      if (activeIds.length > 0 && intersection.length === 0) {
        reasonCodes.push("NO_TRAINER_ASSIGNMENT");
      }
      if (intersection.length > 0 && skillFiltered.length === 0) {
        reasonCodes.push("NO_SKILL_MATCH");
      }

      memberPackageDiagnostics[memberId] = {
        active_member_packages: activeIds,
        trainer_assigned_packages: trainerAssignedPackageIds,
        intersection_packages: intersection,
        reason_codes: reasonCodes,
      };
    }

    return { memberActivePackageIds, memberBookablePackageIds, memberPackageDiagnostics };
  }

  static async resolvePackageContext(tenantId: string, packageId: string) {
    const pkg = await AppDataSource.getRepository(Package).findOne({
      where: { tenant_id: tenantId, id: packageId, is_active: true },
      select: ["id", "title", "display_price", "rules"],
    });

    if (!pkg) {
      throw new AppError("PACKAGE_NOT_FOUND", 404, "Seçilen paket bulunamadı veya pasif");
    }

    const rules =
      pkg.rules && typeof pkg.rules === "object" && !Array.isArray(pkg.rules)
        ? (pkg.rules as Record<string, unknown>)
        : {};
    const lessonCategory =
      BookingEligibilityService.normalizeLessonCategory(rules.lesson_category) ||
      BookingEligibilityService.normalizeLessonCategory(rules.service_key);

    // Paket kurallari eksikse rezervasyon akisini burada fail ediyoruz;
    // aksi halde daha sonra sessiz uyumsuzluklar olusuyor.
    if (!lessonCategory) {
      throw new AppError("PACKAGE_LESSON_CATEGORY_MISSING", 400, "Paket ders kategorisi tanımsız");
    }

    return {
      pkg,
      rules,
      lessonCategory,
    };
  }

  static async ensureTrainerSkillForCategory(tenantId: string, trainerId: string, lessonCategory: LessonCategory) {
    const skill = await AppDataSource.getRepository(TrainerSkill).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        lesson_category: lessonCategory,
        is_active: true,
      },
    });

    if (!skill) {
      throw new AppError("TRAINER_SKILL_MISMATCH", 400, "Eğitmen bu ders kategorisi için yetkili değil");
    }
  }

  static async ensureTrainerPackageAssignment(tenantId: string, trainerId: string, packageId: string) {
    const assignment = await AppDataSource.getRepository(PackageTrainerAssignment).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        package_id: packageId,
        is_active: true,
      },
    });

    if (!assignment) {
      throw new AppError("PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND", 400, "Bu paket için eğitmen yetkisi bulunmuyor");
    }
  }

  static async ensureMemberActivePackage(tenantId: string, memberId: string, packageId: string) {
    const now = new Date();
    const row = await AppDataSource.getRepository(UserPackage)
      .createQueryBuilder("up")
      .where("up.tenant_id = :tenantId", { tenantId })
      .andWhere("up.user_id = :memberId", { memberId })
      .andWhere("up.package_id = :packageId", { packageId })
      .andWhere("up.is_active = true")
      .andWhere("up.remaining_credits > 0")
      .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
      .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
      .getOne();

    if (!row) {
      throw new AppError("MEMBER_PACKAGE_NOT_ACTIVE", 400, "Danışanın bu paket için aktif ve kullanılabilir hakkı bulunmuyor");
    }

    return row;
  }

  static async ensurePackageBookingEligibility(params: EligibilityParams) {
    const { tenantId, trainerId, memberId, packageId } = params;

    // Kontrol sirasini bilerek boyle tutuyoruz:
    // once uye hakki, sonra egitmen atamasi, sonra kategori/skill uyumu.
    await BookingEligibilityService.ensureMemberActivePackage(tenantId, memberId, packageId);
    await BookingEligibilityService.ensureTrainerPackageAssignment(tenantId, trainerId, packageId);
    const context = await BookingEligibilityService.resolvePackageContext(tenantId, packageId);
    await BookingEligibilityService.ensureTrainerSkillForCategory(tenantId, trainerId, context.lessonCategory);

    return context;
  }
}
