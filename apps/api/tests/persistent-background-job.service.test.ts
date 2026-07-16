import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { BackgroundJob, BackgroundJobStatus, BackgroundJobType } from "../entities/background-job.entity";
import { GroupClassReminderService, isReminderDueWithinWindow } from "../services/group-class-reminder.service";
import { JobLockService } from "../services/job-lock.service";
import { PersistentBackgroundJobService } from "../services/persistent-background-job.service";
import { ProductDemoLeadRetentionService } from "../services/product-demo-lead-retention.service";

describe("PersistentBackgroundJobService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes reminder times missed while the API process was offline", () => {
    const scanStartedAt = new Date("2026-07-16T11:45:00.000Z");
    const restartedAt = new Date("2026-07-16T12:00:00.000Z");
    const classStartsAt = new Date("2026-07-17T11:50:00.000Z");

    expect(isReminderDueWithinWindow(classStartsAt, 24, scanStartedAt, restartedAt)).toBe(true);
    expect(isReminderDueWithinWindow(classStartsAt, 24, restartedAt, new Date("2026-07-16T12:20:00.000Z"))).toBe(false);
  });

  it("registers demo lead retention as a daily singleton job", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((value) => value),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);

    await PersistentBackgroundJobService.ensureJobs(now);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      key: "product-demo-lead-retention",
      type: BackgroundJobType.PRODUCT_DEMO_LEAD_RETENTION,
      status: BackgroundJobStatus.READY,
      interval_seconds: 86_400,
      next_run_at: now,
    }));
  });

  it("runs an overdue reminder after restart and persists its next execution", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const lastCompleted = new Date("2026-07-16T11:45:00.000Z");
    const job = {
      id: "job-1",
      key: "group-class-reminder-scan",
      type: BackgroundJobType.GROUP_CLASS_REMINDER_SCAN,
      status: BackgroundJobStatus.RUNNING,
      interval_seconds: 900,
      next_run_at: new Date("2026-07-16T11:50:00.000Z"),
      last_completed_at: lastCompleted,
      consecutive_failures: 0,
    } as BackgroundJob;
    const repo = {
      find: vi.fn().mockResolvedValue([job]),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === BackgroundJob) return repo as any;
      return {} as any;
    });
    vi.spyOn(JobLockService, "withAdvisoryLock").mockImplementation(async (_source, _key, task) => ({
      executed: true,
      result: await task(),
    }));
    const trigger = vi.spyOn(GroupClassReminderService, "triggerAllTenants").mockResolvedValue({
      executed: true,
      result: { tenantCount: 1 },
    });

    const result = await PersistentBackgroundJobService.runDue(now);

    expect(result).toEqual({ executed: true, result: { processed: 1 } });
    expect(trigger).toHaveBeenCalledWith({ from: lastCompleted, now });
    expect(job.status).toBe(BackgroundJobStatus.READY);
    expect(job.next_run_at.toISOString()).toBe("2026-07-16T12:15:00.000Z");
    expect(job.last_completed_at).toBeInstanceOf(Date);
  });

  it("dispatches the daily demo lead retention job through the persistent worker", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const job = {
      id: "job-retention",
      key: "product-demo-lead-retention",
      type: BackgroundJobType.PRODUCT_DEMO_LEAD_RETENTION,
      status: BackgroundJobStatus.READY,
      interval_seconds: 86_400,
      next_run_at: new Date("2026-07-16T11:00:00.000Z"),
      consecutive_failures: 0,
    } as BackgroundJob;
    const repo = {
      find: vi.fn().mockResolvedValue([job]),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === BackgroundJob) return repo as any;
      return {} as any;
    });
    vi.spyOn(JobLockService, "withAdvisoryLock").mockImplementation(async (_source, _key, task) => ({
      executed: true,
      result: await task(),
    }));
    const purge = vi.spyOn(ProductDemoLeadRetentionService, "purgeExpired").mockResolvedValue({
      cutoff: new Date("2025-07-16T12:00:00.000Z"),
      retentionDays: 365,
      deleted: 2,
    });

    const result = await PersistentBackgroundJobService.runDue(now);

    expect(result).toEqual({ executed: true, result: { processed: 1 } });
    expect(purge).toHaveBeenCalledWith(now);
    expect(job.status).toBe(BackgroundJobStatus.READY);
    expect(job.next_run_at.toISOString()).toBe("2026-07-17T12:00:00.000Z");
    expect(job.consecutive_failures).toBe(0);
  });
});
