// Bu controller internal tarafindaki clinic requests.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { In } from "typeorm";
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonMembership, SalonMembershipStatus, MembershipPaymentStatus } from "../../entities/salon-membership.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuditLogService } from "../../services/audit-log.service";
import { AuditLog } from "../../entities/audit-log.entity";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export class InternalClinicRequestsController {
  private static async logClinicAudit(
    req: Request,
    input: {
      eventType: string;
      tenant: Tenant;
      metadata?: Record<string, unknown>;
    }
  ) {
    await AuditLogService.log({
      tenant_id: input.tenant.id,
      actor_role: "OWNER",
      event_type: input.eventType,
      action: input.eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: (req as Request & { requestId?: string }).requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "tenant",
      target_id: input.tenant.id,
      metadata: {
        tenant_id: input.tenant.id,
        tenant_slug: input.tenant.slug,
        tenant_name: input.tenant.name,
        ...input.metadata,
      },
    });
  }

  static async list(_req: Request, res: Response) {
    const rows = (await AppDataSource.getRepository(Tenant).find({ order: { created_at: "DESC" } })).filter((row) => row.owner_account_id);
    const ownerIds = Array.from(new Set(rows.map((row) => row.owner_account_id!).filter(Boolean)));
    const [accounts, profiles] = await Promise.all([
      ownerIds.length ? AppDataSource.getRepository(Account).find({ where: { id: In(ownerIds) } as any }) : [],
      rows.length ? AppDataSource.getRepository(SalonProfile).find({ where: { tenant_id: In(rows.map((row) => row.id)) } as any }) : [],
    ]);
    const accountMap = new Map(accounts.map((row) => [row.id, row]));
    const profileMap = new Map(profiles.map((row) => [row.tenant_id, row]));

    return res.json({
      data: rows.map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        review_status: tenant.review_status,
        subscription_status: tenant.subscription_status,
        is_public: tenant.is_public,
        trial_starts_at: tenant.trial_starts_at || null,
        trial_ends_at: tenant.trial_ends_at || null,
        review_note: tenant.review_note || null,
        boost_until: tenant.boost_until || null,
        city: String((profileMap.get(tenant.id)?.location as any)?.city ?? "").trim() || null,
        district: String((profileMap.get(tenant.id)?.location as any)?.district ?? "").trim() || null,
        owner: tenant.owner_account_id
          ? {
              id: tenant.owner_account_id,
              full_name: `${accountMap.get(tenant.owner_account_id)?.first_name || ""} ${accountMap.get(tenant.owner_account_id)?.last_name || ""}`.trim(),
              email: accountMap.get(tenant.owner_account_id)?.email || null,
              phone: accountMap.get(tenant.owner_account_id)?.phone || null,
            }
          : null,
      })),
    });
  }

  static async listDemoLeads(_req: Request, res: Response) {
    const rows = await AppDataSource.getRepository(AuditLog).find({
      where: { event_type: "PRODUCT_SITE_DEMO_LEAD_SUBMIT" },
      order: { created_at: "DESC" },
      take: 100,
    });

    return res.json({
      data: rows.map((row) => {
        const metadata = row.metadata || {};
        return {
          id: row.id,
          created_at: row.created_at,
          full_name: String(metadata.full_name || ""),
          clinic_name: String(metadata.clinic_name || ""),
          phone: String(metadata.phone || ""),
          city: String(metadata.city || ""),
          note: String(metadata.note || ""),
          source: String(metadata.source || "PRODUCT_SITE_DEMO"),
        };
      }),
    });
  }

  static async publish(req: Request, res: Response) {
    const tenantId = String(req.params.id || "");
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const membershipRepo = AppDataSource.getRepository(SalonMembership);
    const accountRepo = AppDataSource.getRepository(Account);
    const userRepo = AppDataSource.getRepository(User);
    const profileRepo = AppDataSource.getRepository(SalonProfile);

    const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || !tenant.owner_account_id) {
      throw new AppError("CLINIC_NOT_FOUND", 404, "Klinik başvurusu bulunamadı");
    }

    const [account, membership, profile] = await Promise.all([
      accountRepo.findOne({ where: { id: tenant.owner_account_id } }),
      membershipRepo.findOne({ where: { account_id: tenant.owner_account_id, tenant_id: tenant.id, role: UserRole.ADMIN } }),
      profileRepo.findOne({ where: { tenant_id: tenant.id }, order: { updated_at: "DESC" } }),
    ]);
    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", 404, "Klinik sahibi hesabı bulunamadı");

    tenant.review_status = TenantReviewStatus.PUBLISHED;
    tenant.subscription_status = TenantSubscriptionStatus.INACTIVE;
    tenant.is_public = true;
    tenant.review_note = note;
    tenant.reviewed_at = new Date();
    tenant.trial_starts_at = null;
    tenant.trial_ends_at = null;
    await tenantRepo.save(tenant);

    if (profile) {
      profile.is_published = true;
      await profileRepo.save(profile);
    }

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

    const adminMembership = membership || membershipRepo.create({
      account_id: account.id,
      tenant_id: tenant.id,
      role: UserRole.ADMIN,
    });
    adminMembership.user_id = linkedUser.id;
    adminMembership.status = SalonMembershipStatus.ACTIVE;
    adminMembership.payment_status = MembershipPaymentStatus.VERIFIED;
    adminMembership.approved_at = new Date();
    adminMembership.is_active_context = true;
    adminMembership.joined_at = adminMembership.joined_at || new Date();
    adminMembership.left_at = null;

    await membershipRepo
      .createQueryBuilder()
      .update(SalonMembership)
      .set({ is_active_context: false })
      .where("account_id = :accountId AND id != :membershipId", { accountId: account.id, membershipId: adminMembership.id || "00000000-0000-0000-0000-000000000000" })
      .execute();

    await membershipRepo.save(adminMembership);
    await InternalClinicRequestsController.logClinicAudit(req, {
      eventType: "INTERNAL_CLINIC_PUBLISHED",
      tenant,
      metadata: {
        review_status: tenant.review_status,
        subscription_status: tenant.subscription_status,
      },
    });
    return res.json({ data: await TenantLifecycleService.syncTenantState(tenant) });
  }

  static async reject(req: Request, res: Response) {
    const tenantId = String(req.params.id || "");
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "FizyoFlow incelemesi sonrası reddedildi";
    const repo = AppDataSource.getRepository(Tenant);
    const profileRepo = AppDataSource.getRepository(SalonProfile);
    const membershipRepo = AppDataSource.getRepository(SalonMembership);

    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new AppError("CLINIC_NOT_FOUND", 404, "Klinik başvurusu bulunamadı");

    tenant.review_status = TenantReviewStatus.REJECTED;
    tenant.subscription_status = TenantSubscriptionStatus.INACTIVE;
    tenant.is_public = false;
    tenant.review_note = note;
    tenant.reviewed_at = new Date();
    await repo.save(tenant);

    const profile = await profileRepo.findOne({ where: { tenant_id: tenant.id }, order: { updated_at: "DESC" } });
    if (profile) {
      profile.is_published = false;
      await profileRepo.save(profile);
    }

    await membershipRepo
      .createQueryBuilder()
      .update(SalonMembership)
      .set({ status: SalonMembershipStatus.REJECTED, is_active_context: false })
      .where("tenant_id = :tenantId AND role = :role", { tenantId: tenant.id, role: UserRole.ADMIN })
      .execute();

    await InternalClinicRequestsController.logClinicAudit(req, {
      eventType: "INTERNAL_CLINIC_REJECTED",
      tenant,
      metadata: {
        review_status: tenant.review_status,
        subscription_status: tenant.subscription_status,
        review_note: tenant.review_note || null,
      },
    });
    return res.json({ data: tenant });
  }

  static async activate(req: Request, res: Response) {
    const tenantId = String(req.params.id || "");
    const repo = AppDataSource.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new AppError("CLINIC_NOT_FOUND", 404, "Klinik bulunamadı");

    tenant.review_status = TenantReviewStatus.PUBLISHED;
    tenant.subscription_status = TenantSubscriptionStatus.ACTIVE;
    tenant.is_public = true;
    if (!tenant.trial_starts_at) {
      tenant.trial_starts_at = new Date();
    }
    if (!tenant.trial_ends_at) {
      tenant.trial_ends_at = plusDays(14);
    }
    await repo.save(tenant);
    await InternalClinicRequestsController.logClinicAudit(req, {
      eventType: "INTERNAL_CLINIC_ACTIVATED",
      tenant,
      metadata: {
        review_status: tenant.review_status,
        subscription_status: tenant.subscription_status,
      },
    });
    return res.json({ data: tenant });
  }

  static async boost(req: Request, res: Response) {
    const tenantId = String(req.params.id || "");
    const days = Math.max(1, Math.min(30, Number(req.body?.days) || 7));
    const repo = AppDataSource.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new AppError("CLINIC_NOT_FOUND", 404, "Klinik bulunamadı");

    const boostUntil = new Date();
    boostUntil.setDate(boostUntil.getDate() + days);
    tenant.boost_until = boostUntil;
    await repo.save(tenant);
    await InternalClinicRequestsController.logClinicAudit(req, {
      eventType: "INTERNAL_CLINIC_BOOSTED",
      tenant,
      metadata: {
        boost_days: days,
        boost_until: tenant.boost_until?.toISOString() || null,
      },
    });
    return res.json({ data: tenant });
  }
}
