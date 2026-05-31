import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/account.entity";
import { Booking } from "../entities/booking.entity";
import { Package } from "../entities/package.entity";
import { SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { StartupConfigService } from "../services/startup-config.service";

async function assertStep(name: string, check: () => Promise<void>) {
  const startedAt = Date.now();
  await check();
  console.log(JSON.stringify({ event: "smoke_step_passed", step: name, duration_ms: Date.now() - startedAt }));
}

async function main() {
  StartupConfigService.validateProductionEnv();
  await AppDataSource.initialize();

  await assertStep("database_connection", async () => {
    await AppDataSource.query("SELECT 1");
  });

  let tenant: Tenant | null = null;
  await assertStep("published_active_tenant_exists", async () => {
    tenant = await AppDataSource.getRepository(Tenant).findOne({
      where: [
        {
          is_active: true,
          is_public: true,
          review_status: TenantReviewStatus.PUBLISHED,
          subscription_status: TenantSubscriptionStatus.ACTIVE,
        },
        {
          is_active: true,
          is_public: true,
          review_status: TenantReviewStatus.PUBLISHED,
          subscription_status: TenantSubscriptionStatus.TRIAL,
        },
      ],
      order: { updated_at: "DESC" },
    });
    if (!tenant) {
      throw new Error("No published ACTIVE/TRIAL tenant found for smoke test");
    }
  });

  await assertStep("tenant_has_active_member_trainer_admin", async () => {
    const tenantId = tenant!.id;
    const [member, trainer, admin] = await Promise.all([
      AppDataSource.getRepository(User).findOne({ where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true } }),
      AppDataSource.getRepository(User).findOne({ where: { tenant_id: tenantId, role: UserRole.TRAINER, is_active: true } }),
      AppDataSource.getRepository(User).findOne({ where: { tenant_id: tenantId, role: UserRole.ADMIN, is_active: true } }),
    ]);
    if (!member || !trainer || !admin) {
      throw new Error("Tenant must have active MEMBER, TRAINER and ADMIN users");
    }
  });

  await assertStep("tenant_has_account_membership_context", async () => {
    const membership = await AppDataSource.getRepository(SalonMembership).findOne({
      where: {
        tenant_id: tenant!.id,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      },
    });
    if (!membership?.account_id || !membership.user_id) {
      throw new Error("No active account membership context found");
    }
    const account = await AppDataSource.getRepository(Account).findOne({ where: { id: membership.account_id, is_active: true } });
    if (!account) {
      throw new Error("Active membership account is missing or inactive");
    }
  });

  await assertStep("tenant_has_public_package", async () => {
    const pkg = await AppDataSource.getRepository(Package).findOne({
      where: {
        tenant_id: tenant!.id,
        is_active: true,
        is_public: true,
        is_visible: true,
      },
    });
    if (!pkg) {
      throw new Error("No active public visible package found");
    }
  });

  await assertStep("booking_relations_are_tenant_scoped", async () => {
    const row = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .leftJoin(User, "m", "m.id = b.member_id AND m.tenant_id = b.tenant_id AND m.role = :memberRole", {
        memberRole: UserRole.MEMBER,
      })
      .leftJoin(User, "t", "t.id = b.trainer_id AND t.tenant_id = b.tenant_id AND t.role = :trainerRole", {
        trainerRole: UserRole.TRAINER,
      })
      .where("b.tenant_id = :tenantId", { tenantId: tenant!.id })
      .andWhere("(m.id IS NULL OR t.id IS NULL)")
      .getOne();
    if (row) {
      throw new Error(`Booking has broken tenant-scoped actor references: ${row.id}`);
    }
  });

  console.log(JSON.stringify({ event: "smoke_passed", tenant_id: tenant!.id, tenant_slug: tenant!.slug }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: "smoke_failed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
