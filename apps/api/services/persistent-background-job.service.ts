import { LessThanOrEqual } from "typeorm";
import { AppDataSource } from "../data-source";
import { BackgroundJob, BackgroundJobStatus, BackgroundJobType } from "../entities/background-job.entity";
import { GroupClassReminderService } from "./group-class-reminder.service";
import { JobLockService } from "./job-lock.service";
import { LoggerService } from "./logger.service";
import { ProductDemoLeadRetentionService } from "./product-demo-lead-retention.service";
import { TrialSubscriptionReminderService } from "./trial-subscription-reminder.service";

const JOB_DEFINITIONS = [
  {
    key: "group-class-reminder-scan",
    type: BackgroundJobType.GROUP_CLASS_REMINDER_SCAN,
    intervalSeconds: 15 * 60,
    enabled: () => process.env.ENABLE_GROUP_CLASS_REMINDER_BATCH !== "false",
  },
  {
    key: "trial-subscription-reminder-scan",
    type: BackgroundJobType.TRIAL_SUBSCRIPTION_REMINDER_SCAN,
    intervalSeconds: 30 * 60,
    enabled: () => process.env.ENABLE_TRIAL_SUBSCRIPTION_REMINDER_BATCH !== "false",
  },
  {
    key: "product-demo-lead-retention",
    type: BackgroundJobType.PRODUCT_DEMO_LEAD_RETENTION,
    intervalSeconds: 24 * 60 * 60,
    enabled: () => true,
  },
] as const;

function messageOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "BACKGROUND_JOB_FAILED")).slice(0, 500);
}

export class PersistentBackgroundJobService {
  static async ensureJobs(now = new Date()) {
    const repo = AppDataSource.getRepository(BackgroundJob);
    for (const definition of JOB_DEFINITIONS.filter((row) => row.enabled())) {
      const existing = await repo.findOne({ where: { key: definition.key } });
      if (existing) {
        if (existing.interval_seconds !== definition.intervalSeconds || existing.type !== definition.type) {
          existing.interval_seconds = definition.intervalSeconds;
          existing.type = definition.type;
          await repo.save(existing);
        }
        continue;
      }
      try {
        await repo.save(repo.create({
          key: definition.key,
          type: definition.type,
          status: BackgroundJobStatus.READY,
          interval_seconds: definition.intervalSeconds,
          next_run_at: now,
          consecutive_failures: 0,
        }));
      } catch (error) {
        // Another API instance can create the same singleton job during a rolling deploy.
        if ((error as { code?: string })?.code !== "23505") throw error;
      }
    }
  }

  static async runDue(now = new Date()) {
    return JobLockService.withAdvisoryLock(AppDataSource, "persistent-background-job-worker", async () => {
      const repo = AppDataSource.getRepository(BackgroundJob);
      const jobs = await repo.find({
        where: { next_run_at: LessThanOrEqual(now) } as any,
        order: { next_run_at: "ASC" },
      });

      for (const job of jobs) {
        const definition = JOB_DEFINITIONS.find((row) => row.key === job.key);
        if (!definition?.enabled()) continue;

        const previousCompletedAt = job.last_completed_at || new Date(now.getTime() - job.interval_seconds * 1000);
        job.status = BackgroundJobStatus.RUNNING;
        job.last_started_at = now;
        await repo.save(job);

        try {
          if (job.type === BackgroundJobType.GROUP_CLASS_REMINDER_SCAN) {
            await GroupClassReminderService.triggerAllTenants({ from: previousCompletedAt, now });
          } else if (job.type === BackgroundJobType.TRIAL_SUBSCRIPTION_REMINDER_SCAN) {
            await TrialSubscriptionReminderService.triggerAllTenants();
          } else if (job.type === BackgroundJobType.PRODUCT_DEMO_LEAD_RETENTION) {
            await ProductDemoLeadRetentionService.purgeExpired(now);
          }
          job.status = BackgroundJobStatus.READY;
          job.last_completed_at = new Date();
          job.next_run_at = new Date(now.getTime() + job.interval_seconds * 1000);
          job.consecutive_failures = 0;
          job.last_error = null;
        } catch (error) {
          job.status = BackgroundJobStatus.READY;
          job.consecutive_failures = Number(job.consecutive_failures || 0) + 1;
          job.last_error = messageOf(error);
          job.next_run_at = new Date(now.getTime() + Math.min(job.interval_seconds * 1000, 60_000));
          LoggerService.error("persistent_background_job_failed", error, { job: job.key });
        }
        await repo.save(job);
      }

      return { processed: jobs.length };
    });
  }
}
