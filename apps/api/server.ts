// Backend process'inin bootstrap noktasi bu dosyadir.
// Veritabani baglantisi, HTTP sunucusu ve zamanlanmis arka plan isleri buradan ayaga kalkar.
import "dotenv/config";
import "reflect-metadata";
import { createApp } from "./app";
import { AppDataSource } from "./data-source";
import { Tenant } from "./entities/tenant.entity";
import { GroupClassReminderService } from "./services/group-class-reminder.service";
import { JobLockService } from "./services/job-lock.service";
import { RiskNotificationService } from "./services/risk-notification.service";

// HTTP sunucusu ve zamanlanmis batch isleri ayni process'te ayaga kalkiyor.
// Bu dosya operasyonel bootstrap noktasi olarak davranir.
async function runDailyRiskBatch() {
  // Advisory lock ayni batch'in birden fazla instance tarafindan ayni anda calismasini engeller.
  const lock = await JobLockService.withAdvisoryLock(AppDataSource, "risk-daily-batch", async () => {
    const tenants = await AppDataSource.getRepository(Tenant).find({
      where: { is_active: true },
      select: ["id", "slug"],
    });

    for (const tenant of tenants) {
      try {
        const result = await RiskNotificationService.trigger({
          tenantId: tenant.id,
          riskSegment: "AT_RISK",
        });
        console.log(
          JSON.stringify({
            event: "risk_batch_tenant_done",
            tenant: tenant.slug,
            targeted: result.totalTargeted,
          })
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "risk_batch_tenant_failed",
            tenant: tenant.slug,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }
  });

  if (!lock.executed) {
    console.log(
      JSON.stringify({
        event: "risk_batch_lock_skipped",
        reason: "advisory_lock_not_acquired",
      })
    );
  }
}

async function bootstrap() {
  // DataSource initialize edilmeden repository'ler kullanilamaz.
  await AppDataSource.initialize();

  const app = createApp();
  const port = Number(process.env.PORT || 5501);

  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });

  if (process.env.ENABLE_RISK_DAILY_BATCH !== "false") {
    const dayMs = 24 * 60 * 60 * 1000;
    const warmupMs = 15 * 1000;
    // Warmup ilk deploy sonrasi gun sonunu beklemeden batch'in bir kez calismasini saglar.
    setTimeout(() => {
      runDailyRiskBatch().catch((error) => console.error("[risk-batch] warmup failed", error));
    }, warmupMs);
    setInterval(() => {
      runDailyRiskBatch().catch((error) => console.error("[risk-batch] interval failed", error));
    }, dayMs);
  }

  if (process.env.ENABLE_GROUP_CLASS_REMINDER_BATCH !== "false") {
    const intervalMs = 15 * 60 * 1000;
    const warmupMs = 25 * 1000;
    setTimeout(() => {
      GroupClassReminderService.triggerAllTenants().catch((error) =>
        console.error("[group-class-reminder] warmup failed", error)
      );
    }, warmupMs);
    setInterval(() => {
      GroupClassReminderService.triggerAllTenants().catch((error) =>
        console.error("[group-class-reminder] interval failed", error)
      );
    }, intervalMs);
  }
}

bootstrap().catch((e) => {
  console.error("Bootstrap failed:", e);
  process.exit(1);
});
