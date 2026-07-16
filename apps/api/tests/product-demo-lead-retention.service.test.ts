import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { ProductDemoLead } from "../entities/product-demo-lead.entity";
import {
  ProductDemoLeadRetentionService,
  resolveProductDemoLeadRetentionDays,
} from "../services/product-demo-lead-retention.service";

describe("ProductDemoLeadRetentionService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEMO_LEAD_RETENTION_DAYS;
  });

  it("uses the default and clamps configured retention days", () => {
    expect(resolveProductDemoLeadRetentionDays("")).toBe(365);
    expect(resolveProductDemoLeadRetentionDays("invalid")).toBe(365);
    expect(resolveProductDemoLeadRetentionDays("7")).toBe(30);
    expect(resolveProductDemoLeadRetentionDays("90.9")).toBe(90);
    expect(resolveProductDemoLeadRetentionDays("9999")).toBe(3650);
  });

  it("physically deletes every expired row, including soft-deleted leads", async () => {
    process.env.DEMO_LEAD_RETENTION_DAYS = "90";
    const now = new Date("2026-07-16T12:00:00.000Z");
    const execute = vi.fn().mockResolvedValue({ affected: 3 });
    const where = vi.fn().mockReturnValue({ execute });
    const from = vi.fn().mockReturnValue({ where });
    const deleteQuery = vi.fn().mockReturnValue({ from });
    const createQueryBuilder = vi.fn().mockReturnValue({ delete: deleteQuery });

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({ createQueryBuilder } as any);

    const result = await ProductDemoLeadRetentionService.purgeExpired(now);

    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith(ProductDemoLead);
    expect(where).toHaveBeenCalledWith("created_at < :cutoff", {
      cutoff: new Date("2026-04-17T12:00:00.000Z"),
    });
    expect(result).toEqual({
      cutoff: new Date("2026-04-17T12:00:00.000Z"),
      retentionDays: 90,
      deleted: 3,
    });
  });
});
