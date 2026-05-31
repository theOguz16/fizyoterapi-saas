import { Router } from "express";
import { AuthController } from "../../controllers/auth.controller";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonMembership, MembershipPaymentStatus, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { hashPassword } from "../../services/password.service";

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
