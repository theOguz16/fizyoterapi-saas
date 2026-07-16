import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { InternalAuditLogsController } from "../controllers/internal/audit-logs.controller";
import { AuditLogService } from "../services/audit-log.service";

describe("product funnel report", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns every funnel step with unique funnel conversion", async () => {
    const query: any = {};
    for (const method of ["select", "addSelect", "where", "andWhere", "groupBy"]) {
      query[method] = vi.fn().mockReturnValue(query);
    }
    query.getRawMany = vi.fn().mockResolvedValue([
      { event_name: "app_opened", event_count: "120", unique_funnels: "100", unique_accounts: "0", unique_tenants: "0" },
      { event_name: "clinic_signup_started", event_count: "65", unique_funnels: "50", unique_accounts: "0", unique_tenants: "0" },
      { event_name: "clinic_created", event_count: "22", unique_funnels: "20", unique_accounts: "20", unique_tenants: "20" },
    ]);
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({ createQueryBuilder: vi.fn().mockReturnValue(query) } as any);

    const report = await AuditLogService.getProductFunnelReport({
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(report.steps).toHaveLength(10);
    expect(report.steps[0]).toMatchObject({ event_name: "app_opened", unique_funnels: 100, conversion_from_previous_percent: null });
    expect(report.steps[1]).toMatchObject({ event_name: "clinic_signup_started", unique_funnels: 50, conversion_from_previous_percent: 50 });
    expect(report.steps[2]).toMatchObject({ event_name: "clinic_created", unique_funnels: 20, conversion_from_previous_percent: 40 });
    expect(report.steps[3]).toMatchObject({ event_name: "trial_started", event_count: 0 });
  });

  it("exposes a date-bounded internal aggregate endpoint", async () => {
    const report = { from: "2026-07-01", to: "2026-07-31", tenant_id: null, steps: [] } as any;
    const aggregate = vi.spyOn(AuditLogService, "getProductFunnelReport").mockResolvedValue(report);
    const res = { json: vi.fn().mockReturnThis() };

    await InternalAuditLogsController.funnel({
      query: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.000Z" },
    } as any, res as any);

    expect(aggregate).toHaveBeenCalledWith({
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T23:59:59.000Z"),
      tenant_id: null,
    });
    expect(res.json).toHaveBeenCalledWith({ data: report });
  });

  it("rejects inverted report ranges", async () => {
    await expect(InternalAuditLogsController.funnel({
      query: { from: "2026-08-01", to: "2026-07-01" },
    } as any, { json: vi.fn() } as any)).rejects.toMatchObject({ code: "INVALID_DATE_RANGE", statusCode: 400 });
  });
});
