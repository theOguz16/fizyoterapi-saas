// Bu controller genel tarafindaki auth.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/user.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AppError } from "../errors/AppError";
import { Account } from "../entities/account.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { SalonApplication, SalonApplicationStatus } from "../entities/salon-application.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { JwtPayload } from "../middlewares/auth.middleware";
import { hashPassword, verifyPassword } from "../services/password.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { MemberRequestCleanupService } from "../services/member-request-cleanup.service";
import { AuditLogService } from "../services/audit-log.service";

type LoginInput = {
  email: string;
  password: string;
  tenantSlug?: string;
};

type RegisterInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  account_type?: "MEMBER" | "CLINIC_ADMIN";
  onboarding_profile?: {
    role?: "MEMBER" | "TRAINER" | "ADMIN";
    primary_goal?: string;
    rhythm?: string;
    support_style?: string;
  };
};

// AuthController sadece login/register degil,
// kullanicinin hangi role ve onboarding asamasina dusecegini de belirler.
export class AuthController {
  private static readonly MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
  private static readonly MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

  static async register(req: Request, res: Response) {
    const { email, password, first_name, last_name, phone, account_type, onboarding_profile } = req.body as RegisterInput;
    if (!email || !password || !first_name || !last_name || !phone) {
      throw new AppError("VALIDATION_ERROR", 422, "Ad, soyad, telefon, e-posta ve şifre zorunludur");
    }
    if (String(password).length < 8) {
      throw new AppError("WEAK_PASSWORD", 422, "Şifre en az 8 karakter olmalıdır");
    }

    const accountRepo = AppDataSource.getRepository(Account);
    const existing = await accountRepo.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      throw new AppError("ACCOUNT_EXISTS", 409, "Bu e-posta ile kayıtlı bir hesap zaten var");
    }

    const password_hash = await hashPassword(password);
    const account = accountRepo.create({
      email: email.trim().toLowerCase(),
      password_hash,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.replace(/\D+/g, ""),
      global_role_default: account_type === "CLINIC_ADMIN" ? UserRole.ADMIN : UserRole.MEMBER,
      onboarding_profile: AuthController.normalizeOnboardingProfile(onboarding_profile),
      is_active: true,
    });
    await accountRepo.save(account);

    const role = account.global_role_default === UserRole.ADMIN ? UserRole.ADMIN : UserRole.MEMBER;
    const onboardingState = role === UserRole.ADMIN ? "NO_CLINIC" : "NO_SALON";

    // Kayit sonrasi client'in ek me cagrisi yapmadan devam edebilmesi icin
    // ilk session payload'i burada ayni formatta donulur.
    const session = {
      account,
      role,
      membership: null,
      tenant: null,
      linkedUserId: null,
      onboardingState,
      membershipStatus: "NONE",
      accessToken: AuthController.signToken({
        sub: account.id,
        role,
        accountId: account.id,
        loginScope: "ACCOUNT",
      }),
    };

    await AuditLogService.log({
      actor_account_id: account.id,
      actor_role: role,
      event_type: "AUTH_REGISTER",
      action: "REGISTER",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: (req as any).requestId || null,
      ip_address: req.ip || null,
      user_agent: req.headers["user-agent"],
      metadata: {
        email: account.email,
        onboarding_state: session.onboardingState,
      },
    });

    return AuthController.respondWithSession(res, session);
  }

  private static normalizeOnboardingProfile(input?: RegisterInput["onboarding_profile"]) {
    if (!input) return null;
    const role = String(input.role || "").toUpperCase();
    const primary_goal = String(input.primary_goal || "").trim();
    const rhythm = String(input.rhythm || "").trim();
    const support_style = String(input.support_style || "").trim();

    if (!primary_goal || !rhythm || !support_style) {
      return null;
    }

    return {
      role: role === "ADMIN" ? UserRole.ADMIN : role === "TRAINER" ? UserRole.TRAINER : UserRole.MEMBER,
      primary_goal,
      rhythm,
      support_style,
    };
  }

  static async login(req: Request, res: Response) {
    const { email, password, tenantSlug } = req.body as LoginInput;

    if (!email || !password) {
      throw new AppError("VALIDATION_ERROR", 422, "email ve password zorunlu");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const accountRepo = AppDataSource.getRepository(Account);
    const membershipRepo = AppDataSource.getRepository(SalonMembership);
    const applicationRepo = AppDataSource.getRepository(SalonApplication);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const account = await accountRepo.findOne({ where: { email: normalizedEmail } });
    if (account) {
      const ok = await verifyPassword(password, account.password_hash);
      if (!ok) {
        throw new AppError("INVALID_LOGIN", 401, "Email/şifre hatalı");
      }
      if (!account.is_active) {
        throw new AppError("USER_INACTIVE", 403, "Hesap aktif değil");
      }
      await MemberRequestCleanupService.cleanupStaleApplicationsForAccount(account.id);

      // Hesabin aktif uyeligi, bekleyen basvurusu ve sahip oldugu salon ayni anda aranir.
      // Cunku kullanicinin ilk acilis ekrani bu uc kaynagin kombinasyonundan cikiyor.
      const activeMembership = await membershipRepo
        .createQueryBuilder("membership")
        .where("membership.account_id = :accountId", { accountId: account.id })
        .andWhere("membership.status = :status", { status: SalonMembershipStatus.ACTIVE })
        .orderBy("membership.is_active_context", "DESC")
        .addOrderBy("membership.updated_at", "DESC")
        .addOrderBy("membership.created_at", "DESC")
        .getOne();
      const pendingApplication = await applicationRepo
        .createQueryBuilder("application")
        .where("application.account_id = :accountId", { accountId: account.id })
        .andWhere(
          "(application.status = :pendingStatus OR (application.status = :approvedStatus AND application.payment_status != :verifiedStatus))",
          {
            pendingStatus: SalonApplicationStatus.PENDING,
            approvedStatus: SalonApplicationStatus.APPROVED,
            verifiedStatus: MembershipPaymentStatus.VERIFIED,
          }
        )
        .orderBy("application.created_at", "DESC")
        .getOne();
      const ownedTenant = await tenantRepo.findOne({
        where: { owner_account_id: account.id },
        order: { created_at: "DESC" },
      });
      const tenant = activeMembership
        ? await TenantLifecycleService.syncTenantState(await tenantRepo.findOne({ where: { id: activeMembership.tenant_id } }))
        : await TenantLifecycleService.syncTenantState(ownedTenant);

      const onboardingState = AuthController.resolveOnboardingState({
        account,
        membership: activeMembership,
        pendingApplication,
        ownedTenant: activeMembership ? null : tenant,
        pendingPaymentRequest: await AuthController.findPendingPaymentRequest(account.id, activeMembership?.user_id || null),
      });
      const role = activeMembership?.role || AuthController.resolveAccountRole(account);

      const session = {
        account,
        role,
        membership: activeMembership,
        tenant,
        linkedUserId: activeMembership?.user_id || null,
        onboardingState,
        membershipStatus: activeMembership ? activeMembership.status : pendingApplication ? pendingApplication.status : "NONE",
        pendingApplication,
        managedClinic: !activeMembership && role === UserRole.ADMIN ? tenant : null,
        accessToken: AuthController.signToken({
          sub: activeMembership?.user_id || account.id,
          tenantId: activeMembership?.tenant_id || null,
          role,
          accountId: account.id,
          linkedUserId: activeMembership?.user_id || null,
          membershipId: activeMembership?.id || null,
          loginScope: "ACCOUNT",
        }),
      };

      await AuditLogService.log({
        tenant_id: activeMembership?.tenant_id || tenant?.id || null,
        actor_user_id: activeMembership?.user_id || null,
        actor_account_id: account.id,
        actor_role: role,
        event_type: "AUTH_LOGIN",
        action: "LOGIN",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: (req as any).requestId || null,
        ip_address: req.ip || null,
        user_agent: req.headers["user-agent"],
        metadata: {
          email: account.email,
          tenant_slug: tenant?.slug || null,
          onboarding_state: session.onboardingState,
        },
      });

      return AuthController.respondWithSession(res, session);
    }

    const legacySession = await AuthController.loginWithLegacyStaff(normalizedEmail, password, tenantSlug);
    if (legacySession) {
      await AuditLogService.log({
        tenant_id: legacySession.membership?.tenant_id || legacySession.tenant?.id || null,
        actor_user_id: legacySession.linkedUserId || null,
        actor_account_id: legacySession.account.id,
        actor_role: legacySession.role,
        event_type: "AUTH_LOGIN",
        action: "LOGIN",
        method: req.method,
        path: req.originalUrl,
        status_code: 200,
        success: true,
        request_id: (req as any).requestId || null,
        ip_address: req.ip || null,
        user_agent: req.headers["user-agent"],
        metadata: {
          email: legacySession.account.email,
          tenant_slug: legacySession.tenant?.slug || null,
          onboarding_state: legacySession.onboardingState,
          login_scope: "LEGACY",
        },
      });
      return AuthController.respondWithSession(res, legacySession);
    }

    throw new AppError("INVALID_LOGIN", 401, "Email/şifre hatalı");
  }

  static async logout(req: Request, res: Response) {
    const auth = (req as any).auth as JwtPayload | undefined;
    await AuditLogService.log({
      tenant_id: auth?.tenantId || null,
      actor_user_id: auth?.linkedUserId || auth?.sub || null,
      actor_account_id: auth?.accountId || null,
      actor_role: auth?.role || null,
      event_type: "AUTH_LOGOUT",
      action: "LOGOUT",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: (req as any).requestId || null,
      ip_address: req.ip || null,
      user_agent: req.headers["user-agent"],
    });
    res.clearCookie("accessToken", {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res.json({ data: true });
  }

  static async me(req: Request, res: Response) {
    const auth = (req as any).auth as JwtPayload | undefined;
    if (!auth?.sub) {
      throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");
    }

    if (auth.loginScope === "ACCOUNT" && auth.accountId) {
      const account = await AppDataSource.getRepository(Account).findOne({ where: { id: auth.accountId } });
      if (!account) {
        throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");
      }
      await MemberRequestCleanupService.cleanupStaleApplicationsForAccount(account.id);
      const membership = auth.membershipId
        ? await AppDataSource.getRepository(SalonMembership).findOne({ where: { id: auth.membershipId } })
        : await AppDataSource.getRepository(SalonMembership)
            .createQueryBuilder("membership")
            .where("membership.account_id = :accountId", { accountId: auth.accountId })
            .andWhere("membership.status = :status", { status: SalonMembershipStatus.ACTIVE })
            .orderBy("membership.is_active_context", "DESC")
            .addOrderBy("membership.updated_at", "DESC")
            .getOne();
      const ownedTenant = await AppDataSource.getRepository(Tenant).findOne({
        where: { owner_account_id: account.id },
        order: { created_at: "DESC" },
      });
      const tenant = membership?.tenant_id
        ? await TenantLifecycleService.syncTenantState(await AppDataSource.getRepository(Tenant).findOne({ where: { id: membership.tenant_id } }))
        : await TenantLifecycleService.syncTenantState(ownedTenant);
      const pendingApplication = await AppDataSource.getRepository(SalonApplication)
        .createQueryBuilder("application")
        .where("application.account_id = :accountId", { accountId: account.id })
        .andWhere(
          "(application.status = :pendingStatus OR (application.status = :approvedStatus AND application.payment_status != :verifiedStatus))",
          {
            pendingStatus: SalonApplicationStatus.PENDING,
            approvedStatus: SalonApplicationStatus.APPROVED,
            verifiedStatus: MembershipPaymentStatus.VERIFIED,
          }
        )
        .orderBy("application.created_at", "DESC")
        .getOne();
      const role = membership?.role || AuthController.resolveAccountRole(account);
      const onboardingState = AuthController.resolveOnboardingState({
        account,
        membership,
        pendingApplication,
        ownedTenant: membership ? null : tenant,
        pendingPaymentRequest: await AuthController.findPendingPaymentRequest(account.id, membership?.user_id || null),
      });
      const [pendingPaymentRequest, activeChangeRequests] = await Promise.all([
        AuthController.findPendingPaymentRequest(account.id, membership?.user_id || null),
        AuthController.findActiveChangeRequests(membership?.tenant_id || null, membership?.user_id || null),
      ]);

      // Mobile client burada sadece kimlik degil, acilis akisini da belirleyen
      // tum karar verilerini birlikte alir.
      return res.json({
        data: {
          sub: auth.sub,
          tenantId: membership?.tenant_id || null,
          role,
          onboarding_state: onboardingState,
          membership_state: onboardingState,
          membership_status: membership?.status || pendingApplication?.status || "NONE",
          recommended_entry_surface: AuthController.resolveRecommendedEntrySurface(role, onboardingState),
          has_active_membership: Boolean(membership),
          has_pending_application: Boolean(pendingApplication),
          has_managed_clinic: Boolean(!membership && role === UserRole.ADMIN && tenant),
          available_personas: [role],
          active_membership: membership
            ? {
                id: membership.id,
                role: membership.role,
                status: membership.status,
                payment_status: membership.payment_status,
                tenant_id: membership.tenant_id,
                tenant_slug: tenant?.slug || null,
                tenant_name: tenant?.name || null,
                linked_user_id: membership.user_id || null,
              }
            : null,
          managed_clinic:
            !membership && role === UserRole.ADMIN && tenant
              ? {
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
                }
              : null,
          pending_application: pendingApplication
          ? {
              id: pendingApplication.id,
              tenant_id: pendingApplication.tenant_id,
              status: pendingApplication.status,
              payment_status: pendingApplication.payment_status,
              payment_reference: pendingApplication.payment_reference || null,
              payment_confirmed_at: pendingApplication.payment_confirmed_at || null,
            }
          : null,
          pending_payment_request: pendingPaymentRequest,
          active_change_requests: activeChangeRequests,
          available_mobile_actions: AuthController.resolveMobileActions(role, { hasActiveMembership: Boolean(membership) }),
          scan_capabilities: AuthController.resolveScanCapabilities(role),
          available_surfaces: AuthController.resolveAvailableSurfaces(role, { hasActiveMembership: Boolean(membership) }),
          user: {
            id: account.id,
            email: account.email,
            role,
            tenantId: membership?.tenant_id || null,
            tenantSlug: tenant?.slug || null,
            fullName: `${account.first_name} ${account.last_name}`.trim(),
            accountId: account.id,
            phone: account.phone,
          },
        },
      });
    }

    const [user, tenant] = await Promise.all([
      AppDataSource.getRepository(User).findOne({
        where: { id: auth.sub, tenant_id: auth.tenantId || undefined },
        select: ["id", "email", "first_name", "last_name", "role", "tenant_id"],
      }),
      auth.tenantId
        ? AppDataSource.getRepository(Tenant).findOne({
            where: { id: auth.tenantId },
            select: ["id", "slug", "name"],
          })
        : Promise.resolve(null),
    ]);

    if (!user || !tenant) {
      throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");
    }

    return res.json({
      data: {
        sub: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        onboarding_state: "ACTIVE_SALON",
        membership_state: "ACTIVE_SALON",
        membership_status: "ACTIVE",
        recommended_entry_surface: AuthController.resolveRecommendedEntrySurface(user.role, "ACTIVE_SALON"),
        has_active_membership: true,
        has_pending_application: false,
        has_managed_clinic: user.role === UserRole.ADMIN,
        available_personas: [user.role],
        active_membership: {
          role: user.role,
          status: "ACTIVE",
          tenant_id: user.tenant_id,
          tenant_slug: tenant.slug,
          tenant_name: tenant.name,
          linked_user_id: user.id,
        },
        available_surfaces: AuthController.resolveAvailableSurfaces(user.role, { hasActiveMembership: true }),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id,
          tenantSlug: tenant.slug,
          fullName: `${user.first_name} ${user.last_name}`.trim(),
        },
      },
    });
  }

  private static async loginWithLegacyStaff(email: string, password: string, tenantSlug?: string) {
    const userRepo = AppDataSource.getRepository(User);
    const tenantRepo = AppDataSource.getRepository(Tenant);
    let user: User | null = null;
    let tenant: Tenant | null = null;

    if (tenantSlug) {
      tenant = await tenantRepo.findOne({ where: { slug: tenantSlug, is_active: true } });
      if (tenant) {
        user = await userRepo.findOne({ where: { tenant_id: tenant.id, email } });
      }
    } else {
      const candidates = await userRepo.find({ where: { email, is_active: true } as any });
      const staffCandidates = candidates.filter((row) => row.role === UserRole.ADMIN || row.role === UserRole.TRAINER);
      if (staffCandidates.length === 1) {
        user = staffCandidates[0];
        tenant = await tenantRepo.findOne({ where: { id: user.tenant_id, is_active: true } });
      } else if (candidates.length === 1) {
        user = candidates[0];
        tenant = await tenantRepo.findOne({ where: { id: user.tenant_id, is_active: true } });
      }
    }

    if (!user || !tenant) return null;
    if (!user.is_active) {
      throw new AppError("USER_INACTIVE", 403, "Hesap aktif değil");
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw new AppError("INVALID_LOGIN", 401, "Email/şifre hatalı");
    }

    const { account, membership } = await AuthController.bootstrapAccountMembership(user, tenant);

    return {
      account,
      role: user.role,
      membership,
      tenant,
      linkedUserId: user.id,
      onboardingState: "ACTIVE_SALON",
      membershipStatus: "ACTIVE",
      accessToken: AuthController.signToken({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
        accountId: account.id,
        linkedUserId: user.id,
        membershipId: membership.id,
        loginScope: "ACCOUNT",
      }),
    };
  }

  private static async bootstrapAccountMembership(user: User, tenant: Tenant) {
    const accountRepo = AppDataSource.getRepository(Account);
    const membershipRepo = AppDataSource.getRepository(SalonMembership);

    let account = await accountRepo.findOne({ where: { email: user.email } });
    if (!account) {
      account = accountRepo.create({
        email: user.email,
        password_hash: user.password_hash,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        global_role_default: user.role,
        is_active: user.is_active,
      });
      await accountRepo.save(account);
    }

    let membership = await membershipRepo.findOne({ where: { account_id: account.id, tenant_id: tenant.id, role: user.role } });
    if (!membership) {
      membership = membershipRepo.create({
        account_id: account.id,
        tenant_id: tenant.id,
        user_id: user.id,
        role: user.role,
        status: SalonMembershipStatus.ACTIVE,
        payment_status: MembershipPaymentStatus.VERIFIED,
        approved_at: new Date(),
        joined_at: new Date(),
        is_active_context: true,
      });
    } else {
      membership.user_id = user.id;
      membership.status = SalonMembershipStatus.ACTIVE;
      membership.payment_status = MembershipPaymentStatus.VERIFIED;
      membership.is_active_context = true;
      membership.left_at = null;
      membership.joined_at = membership.joined_at || new Date();
    }

    await membershipRepo
      .createQueryBuilder()
      .update(SalonMembership)
      .set({ is_active_context: false })
      .where("account_id = :accountId AND id != :id", { accountId: account.id, id: membership.id || "00000000-0000-0000-0000-000000000000" })
      .execute();

    membership = await membershipRepo.save(membership);
    return { account, membership };
  }

  private static signToken(payload: JwtPayload) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError("CONFIG_ERROR", 500, "JWT_SECRET tanımlı değil");
    }

    return jwt.sign(payload, jwtSecret, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
    });
  }

  private static respondWithSession(
    res: Response,
    input: {
      account: Account;
      role: UserRole;
      membership: SalonMembership | null;
      tenant: Tenant | null;
      linkedUserId: string | null;
      onboardingState: string;
      membershipStatus: string;
      accessToken: string;
      pendingApplication?: SalonApplication | null;
      managedClinic?: Tenant | null;
    }
  ) {
    const { account, role, membership, tenant, linkedUserId, onboardingState, membershipStatus, accessToken, pendingApplication, managedClinic } = input;
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      data: {
        accessToken,
        onboarding_state: onboardingState,
        membership_state: onboardingState,
        membership_status: membershipStatus,
        recommended_entry_surface: AuthController.resolveRecommendedEntrySurface(role, onboardingState),
        has_active_membership: Boolean(membership),
        has_pending_application: Boolean(pendingApplication),
        has_managed_clinic: Boolean(!membership && role === UserRole.ADMIN && managedClinic),
        available_personas: [role],
        active_membership: membership
          ? {
              id: membership.id,
              role: membership.role,
              status: membership.status,
              payment_status: membership.payment_status,
              tenant_id: membership.tenant_id,
              tenant_slug: tenant?.slug || null,
              tenant_name: tenant?.name || null,
              linked_user_id: linkedUserId,
            }
          : null,
        pending_application: pendingApplication
          ? {
              id: pendingApplication.id,
              tenant_id: pendingApplication.tenant_id,
              status: pendingApplication.status,
              payment_status: pendingApplication.payment_status,
              payment_reference: pendingApplication.payment_reference || null,
              payment_confirmed_at: pendingApplication.payment_confirmed_at || null,
            }
          : null,
        managed_clinic:
          !membership && role === UserRole.ADMIN && managedClinic
            ? {
                id: managedClinic.id,
                slug: managedClinic.slug,
                name: managedClinic.name,
                review_status: managedClinic.review_status,
                subscription_status: managedClinic.subscription_status,
                is_public: managedClinic.is_public,
                trial_starts_at: managedClinic.trial_starts_at || null,
                trial_ends_at: managedClinic.trial_ends_at || null,
                review_note: managedClinic.review_note || null,
                is_boosted: TenantLifecycleService.isBoosted(managedClinic),
              }
            : null,
        pending_payment_request: null,
        active_change_requests: [],
        available_mobile_actions: AuthController.resolveMobileActions(role, { hasActiveMembership: Boolean(membership) }),
        scan_capabilities: AuthController.resolveScanCapabilities(role),
        available_surfaces: AuthController.resolveAvailableSurfaces(role, { hasActiveMembership: Boolean(membership) }),
        user: {
          id: account.id,
          role,
          tenantId: membership?.tenant_id || null,
          tenantSlug: tenant?.slug || null,
          fullName: `${account.first_name} ${account.last_name}`.trim(),
          email: account.email,
          accountId: account.id,
          phone: account.phone,
        },
      },
    });
  }

  private static resolveAccountRole(account: Account) {
    return account.global_role_default === UserRole.ADMIN ? UserRole.ADMIN : UserRole.MEMBER;
  }

  private static resolveOnboardingState(input: {
    account: Account;
    membership: SalonMembership | null | undefined;
    pendingApplication?: SalonApplication | null;
    ownedTenant?: Tenant | null;
    pendingPaymentRequest?: any | null;
  }) {
    const { account, membership, pendingApplication, ownedTenant, pendingPaymentRequest } = input;
    if (membership) {
      return "ACTIVE_SALON";
    }
    if (account.global_role_default === UserRole.ADMIN) {
      if (!ownedTenant) return "NO_CLINIC";
      if (ownedTenant.review_status === TenantReviewStatus.REJECTED) return "CLINIC_REJECTED";
      if (
        ownedTenant.review_status === TenantReviewStatus.PUBLISHED &&
        ownedTenant.subscription_status === TenantSubscriptionStatus.READ_ONLY
      ) {
        return "CLINIC_READ_ONLY";
      }
      return "PENDING_CLINIC_REVIEW";
    }
    if (pendingPaymentRequest) return "PAYMENT_PENDING";
    return pendingApplication ? "PENDING_APPLICATION" : "NO_SALON";
  }

  private static async findPendingPaymentRequest(accountId: string, linkedUserId?: string | null) {
    const identifiers = [linkedUserId, accountId].filter(Boolean) as string[];
    if (!identifiers.length) return null;

    const event = await MemberRequestCleanupService.findActionablePaymentRequest({ identifiers });

    if (!event) return null;
    return {
      id: event.id,
      status: String(event.payload?.status || "PENDING"),
      amount: typeof event.payload?.amount === "number" ? event.payload.amount : null,
      currency: "TRY",
      package_id: typeof event.payload?.package_id === "string" ? event.payload.package_id : null,
      package_title: typeof event.payload?.package_title === "string" ? event.payload.package_title : null,
      trainer_id: typeof event.payload?.trainer_id === "string" ? event.payload.trainer_id : null,
      tenant_slug: typeof event.payload?.tenant_slug === "string" ? event.payload.tenant_slug : null,
      tenant_name: typeof event.payload?.tenant_name === "string" ? event.payload.tenant_name : null,
      note: typeof event.payload?.note === "string" ? event.payload.note : null,
      selected_days: Array.isArray(event.payload?.selected_days) ? event.payload.selected_days : [],
    };
  }

  private static async findActiveChangeRequests(tenantId?: string | null, linkedUserId?: string | null) {
    if (!tenantId || !linkedUserId) return [];
    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: {
        tenant_id: tenantId,
        member_id: linkedUserId,
        type: AuthController.MEMBER_CHANGE_REQUEST,
        status: NotificationEventStatus.QUEUED,
      } as any,
      order: { created_at: "DESC" },
    });
    return rows.map((row) => ({
      id: row.id,
      type: String(row.payload?.request_type || "PACKAGE_RENEWAL"),
      status: "PENDING",
      created_at: row.created_at,
      reason: typeof row.payload?.note === "string" ? row.payload.note : null,
    }));
  }

  private static resolveMobileActions(role: UserRole, options?: { hasActiveMembership?: boolean }) {
    if (role === UserRole.ADMIN) {
      return options?.hasActiveMembership ? ["VIEW_DASHBOARD", "APPROVE_REQUESTS", "SEND_NOTIFICATIONS"] : ["OWNER_SETUP"];
    }
    if (role === UserRole.TRAINER) {
      return ["CHECKIN", "VIEW_SCHEDULE", "VIEW_EARNINGS"];
    }
    return options?.hasActiveMembership ? ["VIEW_PACKAGES", "CREATE_CHANGE_REQUEST", "SHOW_QR"] : ["DISCOVER_SALON", "CREATE_PAYMENT_REQUEST"];
  }

  private static resolveScanCapabilities(role: UserRole) {
    if (role === UserRole.ADMIN) return ["SALON_ENTRY"];
    if (role === UserRole.TRAINER) return ["TRAINER_CHECKIN"];
    return [];
  }

  private static resolveAvailableSurfaces(role: UserRole, options?: { hasActiveMembership?: boolean }) {
    if (role === UserRole.ADMIN) {
      return { mobile: true, web: Boolean(options?.hasActiveMembership) };
    }
    if (role === UserRole.TRAINER) {
      return { mobile: true, web: true };
    }
    return { mobile: true, web: false };
  }

  private static resolveRecommendedEntrySurface(role: UserRole, onboardingState: string) {
    if (role === UserRole.ADMIN) {
      return onboardingState === "NO_CLINIC" ? "OWNER_SETUP" : "ADMIN_HOME";
    }
    if (role === UserRole.TRAINER) {
      return "TRAINER_HOME";
    }
    if (onboardingState === "PAYMENT_PENDING" || onboardingState === "PENDING_APPLICATION") {
      return "APPLICATION_STATUS";
    }
    if (onboardingState === "ACTIVE_SALON") {
      return "MEMBER_HOME";
    }
    return "DISCOVERY";
  }
}
