import { Router } from "express";
import { AuthController } from "../../controllers/auth.controller";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonMembership, MembershipPaymentStatus, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Tenant, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { hashPassword } from "../../services/password.service";
import { BillingController } from "../../controllers/billing.controller";

export const internalE2ERoutes = Router();

internalE2ERoutes.use((req, _res, next) => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("NOT_FOUND", 404, "Endpoint bulunamadı");
  }
  next();
});

internalE2ERoutes.post("/session", async (req, res, next) => {
  try {
    await ensureRequestedPersona(req.body);
    return AuthController.login(req, res);
  } catch (error) {
    next(error);
  }
});

internalE2ERoutes.post("/subscription-event", async (req, res, next) => {
  try {
    const tenantId = String(req.body?.tenant_id || "").trim();
    const action = String(req.body?.action || "").trim().toUpperCase();
    const billingCycle = String(req.body?.billing_cycle || "monthly").trim().toLowerCase();
    if (!tenantId) throw new AppError("E2E_TENANT_REQUIRED", 422, "E2E salon kimliği gerekli");

    const repo = AppDataSource.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new AppError("E2E_TENANT_NOT_FOUND", 404, "E2E salonu bulunamadı");

    if (action === "RESET") {
      tenant.subscription_status = TenantSubscriptionStatus.READ_ONLY;
      tenant.is_public = false;
      tenant.trial_starts_at = tenant.trial_starts_at || new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      tenant.trial_ends_at = tenant.trial_ends_at || new Date(Date.now() - 24 * 60 * 60 * 1000);
      tenant.subscription_started_at = null;
      tenant.subscription_current_period_ends_at = null;
      tenant.subscription_last_event_at = null;
      tenant.revenuecat_original_app_user_id = null;
      tenant.revenuecat_product_id = null;
      tenant.revenuecat_entitlement_id = null;
      tenant.revenuecat_store = null;
      tenant.revenuecat_last_event_type = null;
      await repo.save(tenant);
      return res.json({ data: { ok: true, action } });
    }

    const eventTypeByAction: Record<string, string> = {
      PURCHASE: "INITIAL_PURCHASE",
      CANCEL: "CANCELLATION",
      RESTORE: "UNCANCELLATION",
    };
    const eventType = eventTypeByAction[action];
    if (!eventType) throw new AppError("E2E_SUBSCRIPTION_ACTION_INVALID", 422, "E2E abonelik aksiyonu geçersiz");

    const now = Date.now();
    req.headers.authorization = String(process.env.REVENUECAT_WEBHOOK_AUTH || "");
    req.body = {
      api_version: "1.0",
      event: {
        type: eventType,
        app_user_id: tenantId,
        original_app_user_id: tenantId,
        entitlement_ids: [String(process.env.REVENUECAT_ENTITLEMENT_ID || "clinic_pro")],
        product_id:
          action !== "PURCHASE" && tenant.revenuecat_product_id
            ? tenant.revenuecat_product_id
            : billingCycle === "yearly"
            ? "fizyoflow_plus_yearly"
            : "fizyoflow_plus_monthly",
        period_type: "NORMAL",
        store: "APP_STORE",
        event_timestamp_ms: now,
        purchased_at_ms: action === "PURCHASE" ? now : undefined,
        expiration_at_ms: now + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
        transaction_id: `e2e-${action.toLowerCase()}-${now}`,
        original_transaction_id: `e2e-subscription-${tenantId}`,
      },
    };
    return BillingController.revenueCatWebhook(req, res);
  } catch (error) {
    next(error);
  }
});

async function ensureRequestedPersona(body: any) {
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const requestedRole = normalizeRole(body?.role);
  const tenantSlug = String(body?.tenantSlug || body?.tenant_slug || "demo-salon").trim().toLowerCase();

  if (!email || !password || !requestedRole) return;

  const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { slug: tenantSlug } });
  if (!tenant) throw new AppError("E2E_TENANT_NOT_FOUND", 404, "E2E salonu bulunamadı");

  const accountRepo = AppDataSource.getRepository(Account);
  const userRepo = AppDataSource.getRepository(User);
  const membershipRepo = AppDataSource.getRepository(SalonMembership);

  let account = await accountRepo.findOne({ where: { email } });
  if (!account) {
    const passwordHash = await hashPassword(password);
    account = accountRepo.create({
      email,
      password_hash: passwordHash,
      first_name: "E2E",
      last_name: "Persona",
      phone: "5550099000",
      global_role_default: requestedRole,
      is_active: true,
    });
    account = await accountRepo.save(account);
  }

  let user = await userRepo.findOne({ where: { tenant_id: tenant.id, email, role: requestedRole } });
  if (!user) {
    user = userRepo.create({
      tenant_id: tenant.id,
      email,
      password_hash: account.password_hash,
      first_name: "E2E",
      last_name: roleLabel(requestedRole),
      role: requestedRole,
      phone: rolePhone(requestedRole),
      qr_code: `E2E-${requestedRole}-PERSONA`,
      is_active: true,
      weekly_class_hours: requestedRole === UserRole.MEMBER ? 1 : null,
    });
    user = await userRepo.save(user);
  }

  let membership = await membershipRepo.findOne({
    where: { account_id: account.id, tenant_id: tenant.id, role: requestedRole },
  });
  if (!membership) {
    membership = membershipRepo.create({
      account_id: account.id,
      tenant_id: tenant.id,
      user_id: user.id,
      role: requestedRole,
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

  if (requestedRole === UserRole.ADMIN && !tenant.owner_account_id) {
    tenant.owner_account_id = account.id;
    await AppDataSource.getRepository(Tenant).save(tenant);
  }

  await membershipRepo
    .createQueryBuilder()
    .update(SalonMembership)
    .set({ is_active_context: false })
    .where("account_id = :accountId", { accountId: account.id })
    .execute();

  await membershipRepo.save(membership);
}

function normalizeRole(value: unknown) {
  const role = String(value || "").toUpperCase();
  if (role === UserRole.ADMIN) return UserRole.ADMIN;
  if (role === UserRole.TRAINER) return UserRole.TRAINER;
  if (role === UserRole.MEMBER) return UserRole.MEMBER;
  return null;
}

function roleLabel(role: UserRole) {
  if (role === UserRole.ADMIN) return "Admin";
  if (role === UserRole.TRAINER) return "Trainer";
  return "Member";
}

function rolePhone(role: UserRole) {
  if (role === UserRole.ADMIN) return "5550099001";
  if (role === UserRole.TRAINER) return "5550099002";
  return "5550099003";
}
