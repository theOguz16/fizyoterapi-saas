// Backend process'inin bootstrap noktasi bu dosyadir.
// Veritabani baglantisi, HTTP sunucusu ve zamanlanmis arka plan isleri buradan ayaga kalkar.
import "dotenv/config";
import "reflect-metadata";
import { createApp } from "./app";
import { AppDataSource } from "./data-source";
import { Tenant } from "./entities/tenant.entity";
import { JobLockService } from "./services/job-lock.service";
import { LoggerService } from "./services/logger.service";
import { RiskNotificationService } from "./services/risk-notification.service";
import { SchemaMaintenanceService } from "./services/schema-maintenance.service";
import { StartupConfigService } from "./services/startup-config.service";
import { PersistentBackgroundJobService } from "./services/persistent-background-job.service";
import { PushDeliveryWorkerService } from "./services/push-delivery-worker.service";

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
        LoggerService.info("risk_batch_tenant_done", {
          tenant: tenant.slug,
          targeted: result.totalTargeted,
        });
      } catch (error) {
        LoggerService.error("risk_batch_tenant_failed", error, { tenant: tenant.slug });
      }
    }
  });

  if (!lock.executed) {
    LoggerService.info("risk_batch_lock_skipped", {
      reason: "advisory_lock_not_acquired",
    });
  }
}

async function bootstrap() {
  StartupConfigService.validateProductionEnv();
  // DataSource initialize edilmeden repository'ler kullanilamaz.
  await AppDataSource.initialize();
  await SchemaMaintenanceService.ensureRuntimeColumns(AppDataSource);
  await PersistentBackgroundJobService.ensureJobs();

  const app = createApp();
  const port = Number(process.env.PORT || 5501);

  app.listen(port, () => {
    LoggerService.info("api_started", { port });
  });

  if (process.env.ENABLE_RISK_DAILY_BATCH !== "false") {
    const dayMs = 24 * 60 * 60 * 1000;
    const warmupMs = 15 * 1000;
    // Warmup ilk deploy sonrasi gun sonunu beklemeden batch'in bir kez calismasini saglar.
    setTimeout(() => {
      runDailyRiskBatch().catch((error) => LoggerService.error("risk_batch_warmup_failed", error));
    }, warmupMs);
    setInterval(() => {
      runDailyRiskBatch().catch((error) => LoggerService.error("risk_batch_interval_failed", error));
    }, dayMs);
  }

  const runPersistentWorkers = async () => {
    await PersistentBackgroundJobService.runDue();
    await PushDeliveryWorkerService.runOnce();
  };
  setTimeout(() => {
    runPersistentWorkers().catch((error) => LoggerService.error("persistent_worker_warmup_failed", error));
  }, 2_000);
  setInterval(() => {
    runPersistentWorkers().catch((error) => LoggerService.error("persistent_worker_interval_failed", error));
  }, 10_000);
}

process.on("unhandledRejection", (error) => {
  LoggerService.error("unhandled_rejection", error);
});

process.on("uncaughtException", (error) => {
  LoggerService.error("uncaught_exception", error);
  process.exit(1);
});

bootstrap().catch((e) => {
  LoggerService.error("bootstrap_failed", e);
  process.exit(1);
});
