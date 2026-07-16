import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSettingsController } from "../controllers/admin/settings.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("working hours product event", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records working_hours_saved only after changed hours are persisted", async () => {
    const profile = {
      id: "profile-1",
      tenant_id: "tenant-1",
      location: {},
      services: [],
      business_hours: {
        timezone: "Europe/Istanbul",
        start_time: "09:00",
        end_time: "18:00",
        slot_minutes: 60,
        break_duration_minutes: 0,
        working_days: [1, 2, 3, 4, 5],
      },
    };
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue(profile),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const templateRepo = { find: vi.fn().mockResolvedValue([]) };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (String(entity?.name || "").includes("SalonProfile")) return profileRepo as any;
      if (String(entity?.name || "").includes("NotificationTemplate")) return templateRepo as any;
      return {} as any;
    });
    vi.spyOn(AdminSettingsController as any, "getGrowthAnalytics").mockResolvedValue({});
    const productEventSpy = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);

    const res = createMockResponse();
    await AdminSettingsController.update(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", accountId: "account-1", role: "ADMIN" },
        method: "PUT",
        originalUrl: "/api/admin/settings",
        headers: { "x-fizyoflow-funnel-id": "funnel-1" },
        body: {
          profile: {
            business_hours: {
              timezone: "Europe/Istanbul",
              start_time: "08:30",
              end_time: "17:30",
              slot_minutes: 45,
              break_duration_minutes: 10,
              working_days: [1, 2, 3, 4, 5, 6],
            },
          },
        },
      } as any,
      res as any
    );

    expect(profileRepo.save.mock.invocationCallOrder[0]).toBeLessThan(productEventSpy.mock.invocationCallOrder[0]);
    expect(productEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "working_hours_saved",
        tenant_id: "tenant-1",
        actor_account_id: "account-1",
        funnel_id: "funnel-1",
        metadata: expect.objectContaining({ working_days_count: 6 }),
      })
    );
    expect(res.statusCode).toBe(200);
  });
});
