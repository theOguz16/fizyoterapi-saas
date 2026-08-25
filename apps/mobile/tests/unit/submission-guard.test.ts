import { describe, expect, it } from "vitest";
import { createAsyncSubmissionGuard, createTapGuard } from "@/lib/submission-guard";

describe("submission guards", () => {
  it("rejects rapid double taps and allows the next deliberate action", () => {
    let time = 1_000;
    const guard = createTapGuard(650, () => time);
    expect(guard.tryAcquire()).toBe(true);
    time += 100;
    expect(guard.tryAcquire()).toBe(false);
    time += 650;
    expect(guard.tryAcquire()).toBe(true);
  });

  it("runs only one async submission until the first settles", async () => {
    const guard = createAsyncSubmissionGuard();
    let release!: () => void;
    const first = guard.run(() => new Promise<string>((resolve) => { release = () => resolve("saved"); }));
    expect(guard.pending).toBe(true);
    await expect(guard.run(async () => "duplicate")).resolves.toEqual({ started: false });
    release();
    await expect(first).resolves.toEqual({ started: true, value: "saved" });
    expect(guard.pending).toBe(false);
  });
});
