// Bu controller account tarafindaki clinic request.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export class AccountClinicRequestController {
  static async createOrUpdate(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    if (!accountId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");

    const clinic_name = String(req.body?.clinic_name ?? "").trim();
    const city = String(req.body?.city ?? "").trim();
    const district = String(req.body?.district ?? "").trim();
    const phone = String(req.body?.phone ?? "").replace(/\D+/g, "");
    const about_text = String(req.body?.about_text ?? "").trim();

    if (!clinic_name || !city || !district || !phone) {
      throw new AppError("VALIDATION_ERROR", 422, "Klinik adı, şehir, ilçe ve telefon zorunludur");
    }

    const accountRepo = AppDataSource.getRepository(Account);
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const profileRepo = AppDataSource.getRepository(SalonProfile);
    const membershipRepo = AppDataSource.getRepository(SalonMembership);

    const applicationRepo = AppDataSource.getRepository(SalonApplication);
    const [account, activeMembership, existingOwnedTenant, unresolvedApplication] = await Promise.all([
      accountRepo.findOne({ where: { id: accountId } }),
      membershipRepo.findOne({ where: { account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true } }),
      tenantRepo.findOne({ where: { owner_account_id: accountId }, order: { created_at: "DESC" } }),
      applicationRepo
        .createQueryBuilder("application")
        .where("application.account_id = :accountId", { accountId })
        .andWhere(
          "(application.status = :pendingStatus OR (application.status = :approvedStatus AND application.payment_status != :verifiedStatus))",
          {
            pendingStatus: SalonApplicationStatus.PENDING,
            approvedStatus: SalonApplicationStatus.APPROVED,
            verifiedStatus: MembershipPaymentStatus.VERIFIED,
          }
        )
        .orderBy("application.created_at", "DESC")
        .getOne(),
    ]);

    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", 404, "Hesap bulunamadı");
    if (activeMembership) {
      throw new AppError("CLINIC_ALREADY_ACTIVE", 409, "Aktif kliniğiniz bulunduğu için yeni bir klinik başvurusu oluşturamazsınız");
    }
    if (unresolvedApplication) {
      throw new AppError("PENDING_APPLICATION_EXISTS", 409, "Önce mevcut salon başvurunuzu tamamlayın veya iptal edin");
    }

    if (account.global_role_default !== UserRole.ADMIN) {
      account.global_role_default = UserRole.ADMIN;
      await accountRepo.save(account);
    }

    let tenant = existingOwnedTenant || null;
    if (tenant && tenant.review_status === TenantReviewStatus.PUBLISHED) {
      throw new AppError("CLINIC_ALREADY_PUBLISHED", 409, "Bu hesap için zaten yayınlanmış bir klinik bulunuyor");
    }

    const baseSlug = slugify(clinic_name);
    if (!baseSlug) throw new AppError("VALIDATION_ERROR", 422, "Geçerli bir klinik adı girin");

    let slug = tenant?.slug || baseSlug;
    if (!tenant || tenant.slug !== slug) {
      let suffix = 1;
      while (true) {
        const conflict = await tenantRepo.findOne({ where: { slug } });
        if (!conflict || conflict.id === tenant?.id) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }
    }

    if (!tenant) {
      tenant = tenantRepo.create({
        owner_account_id: accountId,
        slug,
        name: clinic_name,
        timezone: "Europe/Istanbul",
        is_active: true,
        review_status: TenantReviewStatus.PENDING_REVIEW,
        subscription_status: TenantSubscriptionStatus.INACTIVE,
        is_public: false,
      });
    } else {
      tenant.slug = slug;
      tenant.name = clinic_name;
      tenant.review_status = TenantReviewStatus.PENDING_REVIEW;
      tenant.subscription_status = TenantSubscriptionStatus.INACTIVE;
      tenant.review_note = null;
      tenant.reviewed_at = null;
      tenant.reviewed_by_account_id = null;
      tenant.is_public = false;
      tenant.trial_starts_at = null;
      tenant.trial_ends_at = null;
    }
    tenant = await tenantRepo.save(tenant);

    let profile = await profileRepo.findOne({ where: { tenant_id: tenant.id }, order: { updated_at: "DESC" } });
    if (!profile) {
      profile = profileRepo.create({
        tenant_id: tenant.id,
        slug: tenant.slug,
        hero_title: clinic_name,
        hero_subtitle: `${city} ${district} bölgesinde kişiye özel hareket ve fizyoterapi deneyimi`,
        about_text: about_text || `${clinic_name} için tanıtım metni yakında yayınlanacak.`,
        why_us: [
          { title: "Sade başvuru akışı" },
          { title: "Takip edilebilir ders planı" },
          { title: "Şeffaf gelişim görünümü" },
        ],
        services: [
          { title: "Fizyoterapi Değerlendirme", starting_price: "Bilgi alın" },
          { title: "Kişisel Ders", starting_price: "Bilgi alın" },
        ],
        location: {
          city,
          district,
          address: district,
        } as any,
        social_links: {},
        theme: "clinerva-v2",
        primary_color: "#0EA5E9",
        business_hours: {
          timezone: "Europe/Istanbul",
          working_days: [1, 2, 3, 4, 5, 6],
          start_time: "09:00",
          end_time: "18:00",
          lunch_break_start: "12:30",
          lunch_break_end: "13:30",
          slot_minutes: 60,
        },
        is_published: false,
      });
    } else {
      profile.slug = tenant.slug;
      profile.hero_title = clinic_name;
      profile.hero_subtitle = `${city} ${district} bölgesinde kişiye özel hareket ve fizyoterapi deneyimi`;
      profile.about_text = about_text || profile.about_text;
      profile.location = {
        ...(profile.location || {}),
        city,
        district,
      };
      profile.is_published = false;
    }
    await profileRepo.save(profile);

    let membership = await membershipRepo.findOne({ where: { account_id: accountId, tenant_id: tenant.id, role: UserRole.ADMIN } });
    if (!membership) {
      membership = membershipRepo.create({
        account_id: accountId,
        tenant_id: tenant.id,
        role: UserRole.ADMIN,
        status: SalonMembershipStatus.PENDING,
        is_active_context: false,
      });
    } else {
      membership.role = UserRole.ADMIN;
      membership.status = SalonMembershipStatus.PENDING;
      membership.is_active_context = false;
      membership.left_at = null;
    }
    await membershipRepo.save(membership);

    return res.status(201).json({
      data: AccountClinicRequestController.serializeManagedClinic(await TenantLifecycleService.syncTenantState(tenant), profile),
    });
  }

  static async mine(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    if (!accountId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");

    const tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: { owner_account_id: accountId },
      order: { created_at: "DESC" },
    });
    if (!tenant) {
      return res.json({ data: null });
    }

    const syncedTenant = await TenantLifecycleService.syncTenantState(tenant);
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenant.id },
      order: { updated_at: "DESC" },
    });

    return res.json({
      data: AccountClinicRequestController.serializeManagedClinic(syncedTenant, profile),
    });
  }

  private static serializeManagedClinic(tenant: Tenant | null, profile: SalonProfile | null) {
    if (!tenant) return null;
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      review_status: tenant.review_status,
      subscription_status: tenant.subscription_status,
      is_public: tenant.is_public,
      trial_starts_at: tenant.trial_starts_at || null,
      trial_ends_at: tenant.trial_ends_at || null,
      review_note: tenant.review_note || null,
      is_boosted: TenantLifecycleService.isBoosted(tenant),
      city: String((profile?.location as any)?.city ?? "").trim() || null,
      district: String((profile?.location as any)?.district ?? "").trim() || null,
    };
  }
}
