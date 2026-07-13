// Bu controller account tarafindaki clinic request.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";
import { isReservedPublicSlug } from "../../constants/reserved-slugs";
import { CLINIC_TRIAL_DAYS } from "../../config/subscription";
import { AuditLogService } from "../../services/audit-log.service";

function plusDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
}

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
    const ownerIsPractitioner = req.body?.owner_is_practitioner !== false;

    if (!clinic_name || !city || !district || !phone) {
      throw new AppError("VALIDATION_ERROR", 422, "Klinik adı, şehir, ilçe ve telefon zorunludur");
    }

    return AppDataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(Account);
      const tenantRepo = manager.getRepository(Tenant);
      const profileRepo = manager.getRepository(SalonProfile);
      const membershipRepo = manager.getRepository(SalonMembership);
      const userRepo = manager.getRepository(User);

      const applicationRepo = manager.getRepository(SalonApplication);
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
      const hasExistingOwnerContext = Boolean(
        activeMembership &&
        existingOwnedTenant &&
        activeMembership.tenant_id === existingOwnedTenant.id &&
        activeMembership.role === UserRole.ADMIN
      );
      if (activeMembership && !hasExistingOwnerContext) {
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
      const isClinicActivation = !hasExistingOwnerContext;
      const trialWasAlreadyStarted = Boolean(tenant?.trial_starts_at);
      if (tenant && tenant.review_status === TenantReviewStatus.PUBLISHED && !hasExistingOwnerContext) {
        throw new AppError("CLINIC_ALREADY_PUBLISHED", 409, "Bu hesap için zaten yayınlanmış bir klinik bulunuyor");
      }

      const baseSlug = slugify(clinic_name);
      if (!baseSlug) throw new AppError("VALIDATION_ERROR", 422, "Geçerli bir klinik adı girin");
      if (isReservedPublicSlug(baseSlug)) {
        throw new AppError("RESERVED_SLUG", 422, "Bu klinik URL kodu sistem tarafından ayrılmıştır");
      }

      let slug = tenant?.slug || baseSlug;
      if (!tenant || tenant.slug !== slug) {
        let suffix = 1;
        for (;;) {
          const conflict = await tenantRepo.findOne({ where: { slug } });
          if (!conflict || conflict.id === tenant?.id) break;
          suffix += 1;
          slug = `${baseSlug}-${suffix}`;
        }
      }

      if (!tenant) {
        const trialStartsAt = new Date();
        const trialEndsAt = plusDays(CLINIC_TRIAL_DAYS);
        tenant = tenantRepo.create({
          owner_account_id: accountId,
          slug,
          name: clinic_name,
          timezone: "Europe/Istanbul",
          is_active: true,
          review_status: TenantReviewStatus.PUBLISHED,
          subscription_status: TenantSubscriptionStatus.TRIAL,
          is_public: true,
          trial_starts_at: trialStartsAt,
          trial_ends_at: trialEndsAt,
          subscription_started_at: trialStartsAt,
          subscription_current_period_ends_at: trialEndsAt,
          review_note: "Klinik sahibi mobil akıştan otomatik yayınlandı.",
          reviewed_at: new Date(),
        });
      } else {
        tenant.slug = slug;
        tenant.name = clinic_name;
        tenant.review_status = TenantReviewStatus.PUBLISHED;
        tenant.subscription_status = TenantSubscriptionStatus.TRIAL;
        tenant.review_note = "Klinik sahibi mobil akıştan otomatik yayınlandı.";
        tenant.reviewed_at = new Date();
        tenant.reviewed_by_account_id = null;
        tenant.is_public = true;
        tenant.trial_starts_at = tenant.trial_starts_at || new Date();
        tenant.trial_ends_at = tenant.trial_ends_at || plusDays(CLINIC_TRIAL_DAYS);
        tenant.subscription_started_at = tenant.subscription_started_at || tenant.trial_starts_at;
        tenant.subscription_current_period_ends_at = tenant.subscription_current_period_ends_at || tenant.trial_ends_at;
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
          theme: "fizyoflow-v2",
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
          is_published: true,
          seo_title: `${clinic_name} | ${district} ${city} Fizyoterapi ve Klinik Hizmetleri`,
          seo_description: `${clinic_name}, ${city} ${district} bölgesinde fizyoterapi ve hareket odaklı klinik hizmetleri sunar. Bilgi ve randevu talebi için iletişime geçin.`,
          business_category: "Fizyoterapi Kliniği",
          service_area: [city, district].filter(Boolean),
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
        profile.service_area = [city, district].filter(Boolean);
        profile.seo_title = profile.seo_title || `${clinic_name} | ${district} ${city} Fizyoterapi ve Klinik Hizmetleri`;
        profile.seo_description =
          profile.seo_description ||
          `${clinic_name}, ${city} ${district} bölgesinde fizyoterapi ve hareket odaklı klinik hizmetleri sunar. Bilgi ve randevu talebi için iletişime geçin.`;
        profile.business_category = profile.business_category || "Fizyoterapi Kliniği";
        profile.is_published = true;
      }
      await profileRepo.save(profile);

      let linkedUser = await userRepo.findOne({ where: { tenant_id: tenant.id, email: account.email, role: UserRole.ADMIN } as any });
      if (!linkedUser) {
        linkedUser = userRepo.create({
          tenant_id: tenant.id,
          email: account.email,
          password_hash: account.password_hash,
          first_name: account.first_name,
          last_name: account.last_name,
          phone: account.phone,
          role: UserRole.ADMIN,
          is_active: true,
        });
      } else {
        linkedUser.password_hash = account.password_hash;
        linkedUser.first_name = account.first_name;
        linkedUser.last_name = account.last_name;
        linkedUser.phone = account.phone;
        linkedUser.role = UserRole.ADMIN;
        linkedUser.is_active = true;
      }
      linkedUser = await userRepo.save(linkedUser);

      let membership = await membershipRepo.findOne({ where: { account_id: accountId, tenant_id: tenant.id, role: UserRole.ADMIN } });
      if (!membership) {
        membership = membershipRepo.create({
          account_id: accountId,
          tenant_id: tenant.id,
          user_id: linkedUser.id,
          role: UserRole.ADMIN,
          status: SalonMembershipStatus.ACTIVE,
          payment_status: MembershipPaymentStatus.VERIFIED,
          approved_at: new Date(),
          joined_at: new Date(),
          is_active_context: true,
        });
      } else {
        membership.user_id = linkedUser.id;
        membership.role = UserRole.ADMIN;
        membership.status = SalonMembershipStatus.ACTIVE;
        membership.payment_status = MembershipPaymentStatus.VERIFIED;
        membership.approved_at = membership.approved_at || new Date();
        membership.joined_at = membership.joined_at || new Date();
        membership.is_active_context = true;
        membership.left_at = null;
      }
      await membershipRepo
        .createQueryBuilder()
        .update(SalonMembership)
        .set({ is_active_context: false })
        .where("account_id = :accountId AND id != :membershipId", { accountId, membershipId: membership.id || "00000000-0000-0000-0000-000000000000" })
        .execute();
      await membershipRepo.save(membership);

      let ownerTrainerUser: User | null = null;
      if (ownerIsPractitioner) {
        ownerTrainerUser = await userRepo.findOne({
          where: { tenant_id: tenant.id, email: account.email, role: UserRole.TRAINER } as any,
        });
        if (!ownerTrainerUser) {
          ownerTrainerUser = userRepo.create({
            tenant_id: tenant.id,
            email: account.email,
            password_hash: account.password_hash,
            first_name: account.first_name,
            last_name: account.last_name,
            phone: account.phone,
            role: UserRole.TRAINER,
            is_active: true,
          });
        } else {
          ownerTrainerUser.password_hash = account.password_hash;
          ownerTrainerUser.first_name = account.first_name;
          ownerTrainerUser.last_name = account.last_name;
          ownerTrainerUser.phone = account.phone;
          ownerTrainerUser.role = UserRole.TRAINER;
          ownerTrainerUser.is_active = true;
          ownerTrainerUser.deleted_at = null;
        }
        ownerTrainerUser = await userRepo.save(ownerTrainerUser);

        let trainerMembership = await membershipRepo.findOne({
          where: { account_id: accountId, tenant_id: tenant.id, role: UserRole.TRAINER },
        });
        if (!trainerMembership) {
          trainerMembership = membershipRepo.create({
            account_id: accountId,
            tenant_id: tenant.id,
            user_id: ownerTrainerUser.id,
            role: UserRole.TRAINER,
            status: SalonMembershipStatus.ACTIVE,
            payment_status: MembershipPaymentStatus.VERIFIED,
            approved_at: new Date(),
            joined_at: new Date(),
            is_active_context: false,
          });
        } else {
          trainerMembership.user_id = ownerTrainerUser.id;
          trainerMembership.role = UserRole.TRAINER;
          trainerMembership.status = SalonMembershipStatus.ACTIVE;
          trainerMembership.payment_status = MembershipPaymentStatus.VERIFIED;
          trainerMembership.approved_at = trainerMembership.approved_at || new Date();
          trainerMembership.joined_at = trainerMembership.joined_at || new Date();
          trainerMembership.is_active_context = false;
          trainerMembership.left_at = null;
        }
        await membershipRepo.save(trainerMembership);
      }

      const productContext = {
        install_id: typeof req.headers?.["x-fizyoflow-install-id"] === "string" ? req.headers["x-fizyoflow-install-id"] : null,
        session_id: typeof req.headers?.["x-fizyoflow-session-id"] === "string" ? req.headers["x-fizyoflow-session-id"] : null,
      };

      if (isClinicActivation) {
        await AuditLogService.logProductEvent({
          event_name: "clinic_created",
          ...productContext,
          tenant_id: tenant.id,
          actor_user_id: linkedUser.id,
          actor_account_id: accountId,
          actor_role: UserRole.ADMIN,
          method: req.method,
          path: req.originalUrl,
          target_type: "tenant",
          target_id: tenant.id,
          metadata: { owner_is_practitioner: ownerIsPractitioner },
        }, manager);
      }

      if (!trialWasAlreadyStarted) {
        await AuditLogService.logProductEvent({
          event_name: "trial_started",
          ...productContext,
          tenant_id: tenant.id,
          actor_user_id: linkedUser.id,
          actor_account_id: accountId,
          actor_role: UserRole.ADMIN,
          method: req.method,
          path: req.originalUrl,
          target_type: "tenant",
          target_id: tenant.id,
          metadata: {
            trial_days: CLINIC_TRIAL_DAYS,
            source: "clinic_setup",
          },
        }, manager);
      }

      return res.status(201).json({
        data: {
          ...AccountClinicRequestController.serializeManagedClinic(await TenantLifecycleService.syncTenantState(tenant), profile),
          owner_is_practitioner: ownerIsPractitioner,
          owner_trainer_user_id: ownerTrainerUser?.id || null,
        },
      });
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
      subscription_started_at: tenant.subscription_started_at || null,
      subscription_current_period_ends_at: tenant.subscription_current_period_ends_at || null,
      subscription_last_event_at: tenant.subscription_last_event_at || null,
      review_note: tenant.review_note || null,
      is_boosted: TenantLifecycleService.isBoosted(tenant),
      city: String((profile?.location as any)?.city ?? "").trim() || null,
      district: String((profile?.location as any)?.district ?? "").trim() || null,
    };
  }
}
