import { describe, expect, it, vi } from "vitest";
import { JobLockService } from "../services/job-lock.service";

describe("JobLockService", () => {
  it("acquires and releases the advisory lock on the same database connection", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);
    const runner = {
      connect: vi.fn().mockResolvedValue(undefined),
      query,
      release: vi.fn().mockResolvedValue(undefined),
    };
    const dataSource = { createQueryRunner: vi.fn().mockReturnValue(runner) } as any;
    const task = vi.fn().mockResolvedValue("done");

    await expect(JobLockService.withAdvisoryLock(dataSource, "push-worker", task)).resolves.toEqual({
      executed: true,
      result: "done",
    });
    expect(query).toHaveBeenNthCalledWith(1, "SELECT pg_try_advisory_lock(hashtext($1)) AS locked", ["push-worker"]);
    expect(query).toHaveBeenNthCalledWith(2, "SELECT pg_advisory_unlock(hashtext($1))", ["push-worker"]);
    expect(runner.release).toHaveBeenCalledOnce();
  });

  it("releases the connection when another process owns the lock", async () => {
    const runner = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([{ locked: false }]),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const dataSource = { createQueryRunner: vi.fn().mockReturnValue(runner) } as any;
    const task = vi.fn();

    await expect(JobLockService.withAdvisoryLock(dataSource, "push-worker", task)).resolves.toEqual({
      executed: false,
      result: null,
    });
    expect(task).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledOnce();
  });
});
