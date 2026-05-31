// Grants a real account admin access to a salon without going through purchase/review.
// Intended for controlled testers and App Review demo accounts.
import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { hashPassword } from "../services/password.service";

function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseSubscriptionStatus(value: string | undefined) {
  const normalized = String(value || TenantSubscriptionStatus.ACTIVE).trim().toUpperCase();
  if (!Object.values(TenantSubscriptionStatus).includes(normalized as TenantSubscriptionStatus)) {
    throw new Error(`SUBSCRIPTION_STATUS must be one of: ${Object.values(TenantSubscriptionStatus).join(", ")}`);
  }
  return normalized as TenantSubscriptionStatus;
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const tenantSlug = normalizeSlug(process.env.TENANT_SLUG || `${email.split("@")[0]}-salon`);
  const tenantName = String(process.env.TENANT_NAME || "FizyoFlow Salonu").trim();
  const subscriptionStatus = parseSubscriptionStatus(process.env.SUBSCRIPTION_STATUS);
  const password = String(process.env.ADMIN_PASSWORD || "").trim();
  const firstName = String(process.env.ADMIN_FIRST_NAME || "FizyoFlow").trim();
  const lastName = String(process.env.ADMIN_LAST_NAME || "Admin").trim();
  const phone = String(process.env.ADMIN_PHONE || "5550000000").trim();

  if (!tenantSlug) throw new Error("TENANT_SLUG is invalid");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  await AppDataSource.initialize();

  await AppDataSource.transaction(async (manager) => {
    const accountRepo = manager.getRepository(Account);
    const tenantRepo = manager.getRepository(Tenant);
    const userRepo = manager.getRepository(User);
    const membershipRepo = manager.getRepository(SalonMembership);

    let account = await accountRepo.findOne({ where: { email } });
    if (!account) {
      if (!password) {
        throw new Error("ADMIN_PASSWORD is required when ADMIN_EMAIL does not exist yet");
      }
      account = accountRepo.create({
        email,
        password_hash: await hashPassword(password),
        first_name: firstName,
        last_name: lastName,
        phone,
        global_role_default: UserRole.ADMIN,
        is_active: true,
      });
    } else {
      account.global_role_default = UserRole.ADMIN;
      account.is_active = true;
      if (password) account.password_hash = await hashPassword(password);
      account.first_name = account.first_name || firstName;
      account.last_name = account.last_name || lastName;
      account.phone = account.phone || phone;
    }
    account = await accountRepo.save(account);

    let tenant = await tenantRepo.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      tenant = tenantRepo.create({
        slug: tenantSlug,
        name: tenantName,
        timezone: "Europe/Istanbul",
        is_active: true,
        owner_account_id: account.id,
        review_status: TenantReviewStatus.PUBLISHED,
        subscription_status: subscriptionStatus,
        is_public: true,
        reviewed_at: new Date(),
        review_note: "Manuel admin erişimi için oluşturuldu.",
      });
    } else {
      tenant.name = tenant.name || tenantName;
      tenant.is_active = true;
      tenant.owner_account_id = account.id;
      tenant.review_status = TenantReviewStatus.PUBLISHED;
      tenant.subscription_status = subscriptionStatus;
      tenant.is_public = true;
      tenant.reviewed_at = tenant.reviewed_at || new Date();
      tenant.review_note = tenant.review_note || "Manuel admin erişimi verildi.";
    }
    tenant = await tenantRepo.save(tenant);

    let user = await userRepo.findOne({ where: { tenant_id: tenant.id, email, role: UserRole.ADMIN } });
    if (!user) {
      user = userRepo.create({
        tenant_id: tenant.id,
        email,
        password_hash: account.password_hash,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
        role: UserRole.ADMIN,
        is_active: true,
      });
    } else {
      user.password_hash = account.password_hash;
      user.first_name = account.first_name;
      user.last_name = account.last_name;
      user.phone = account.phone;
      user.role = UserRole.ADMIN;
      user.is_active = true;
    }
    user = await userRepo.save(user);

    let membership = await membershipRepo.findOne({
      where: { account_id: account.id, tenant_id: tenant.id, role: UserRole.ADMIN },
    });
    if (!membership) {
      membership = membershipRepo.create({
        account_id: account.id,
        tenant_id: tenant.id,
        role: UserRole.ADMIN,
      });
    }
    membership.user_id = user.id;
    membership.status = SalonMembershipStatus.ACTIVE;
    membership.payment_status = MembershipPaymentStatus.VERIFIED;
    membership.approved_at = membership.approved_at || new Date();
    membership.joined_at = membership.joined_at || new Date();
    membership.left_at = null;
    membership.is_active_context = true;

    await membershipRepo
      .createQueryBuilder()
      .update(SalonMembership)
      .set({ is_active_context: false })
      .where("account_id = :accountId AND tenant_id != :tenantId", { accountId: account.id, tenantId: tenant.id })
      .execute();

    await membershipRepo.save(membership);

    console.log(
      JSON.stringify(
        {
          ok: true,
          email: account.email,
          tenant_slug: tenant.slug,
          tenant_name: tenant.name,
          review_status: tenant.review_status,
          subscription_status: tenant.subscription_status,
          role: UserRole.ADMIN,
        },
        null,
        2
      )
    );
  });
}

main()
  .catch((error) => {
    console.error("Grant admin failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
