import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalClinicRequestsController } from "../controllers/internal/clinic-requests.controller";
import { AppDataSource } from "../data-source";
import { AuditLog } from "../entities/audit-log.entity";
import { createMockResponse } from "./helpers/route-chain";

describe("internal clinic requests controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists product site demo leads from audit logs", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === AuditLog) {
        return {
          find: vi.fn().mockResolvedValue([
            {
              id: "audit-1",
              created_at: new Date("2026-05-18T10:00:00.000Z"),
              metadata: {
                source: "PRODUCT_SITE_DEMO",
                full_name: "Ayşe Yılmaz",
                clinic_name: "Denge Fizyo",
                phone: "05551112233",
                city: "Kadıköy",
                note: "Demo almak istiyoruz",
              },
            },
          ]),
        } as any;
      }
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    const res = createMockResponse();
    await InternalClinicRequestsController.listDemoLeads({} as any, res as any);

    expect(res.body).toEqual({
      data: [
        {
          id: "audit-1",
          created_at: new Date("2026-05-18T10:00:00.000Z"),
          full_name: "Ayşe Yılmaz",
          clinic_name: "Denge Fizyo",
          phone: "05551112233",
          city: "Kadıköy",
          note: "Demo almak istiyoruz",
          source: "PRODUCT_SITE_DEMO",
        },
      ],
    });
  });
});
