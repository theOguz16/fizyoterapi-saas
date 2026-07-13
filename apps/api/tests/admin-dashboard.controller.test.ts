import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardController } from "../controllers/admin/dashboard.controller";
import { AppDataSource } from "../data-source";
import { RiskService } from "../services/risk.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  count?: number;
  rawOne?: unknown;
}) {
  return {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(result.count ?? 0),
    getRawOne: vi.fn().mockResolvedValue(result.rawOne ?? null),
  };
}

describe("admin dashboard controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates summary metrics, revenue and spotlight data", async () => {
    const leadRepo = {
      count: vi
        .fn()
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1),
    };
    const packageRepo = {
      count: vi
        .fn()
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4),
    };
    const userRepo = {
      count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(25),
      find: vi
        .fn()
        .mockResolvedValueOnce([{ id: "trainer-1", first_name: "Ece", last_name: "Kara", email: "ece@example.com", is_active: true }])
        .mockResolvedValueOnce([{ id: "member-1", first_name: "Ada", last_name: "Yilmaz", email: "ada@example.com", is_active: true }]),
    };
    const bookingQuery = createQueryBuilderMock({ count: 9 });
    const sessionQuery = createQueryBuilderMock({ count: 4 });
    const userPackageQuery = createQueryBuilderMock({
      rawOne: {
        daily_revenue: "1200.50",
        weekly_revenue: "5400.25",
        monthly_revenue: "18200.75",
        yearly_revenue: "98600",
        weekly_credits_sold: "24",
        monthly_credits_sold: "88",
        weekly_pack_8_count: "2",
        weekly_pack_4_count: "1",
        monthly_pack_8_count: "6",
        monthly_pack_4_count: "4",
        yearly_pack_8_count: "40",
        yearly_pack_4_count: "22",
      },
    });
    const profileRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "salon-1",
        slug: "ornek-klinik",
        location: { timezone: "Europe/Istanbul" },
        business_hours: {
          working_days: [1, 2, 3, 4, 5],
          start_time: "09:00",
          end_time: "18:00",
        },
      }),
    };

    vi.spyOn(RiskService, "listRiskMembers").mockResolvedValue({
      data: [{ member_id: "member-9", risk_score: 81 }],
      total: 1,
      limit: 5,
    } as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Lead")) return leadRepo as any;
      if (name.includes("Package") && !name.includes("UserPackage")) return packageRepo as any;
      if (name.includes("UserPackage")) return { createQueryBuilder: vi.fn().mockReturnValue(userPackageQuery) } as any;
      if (name.includes("SalonProfile")) return profileRepo as any;
      if (name.includes("User")) return userRepo as any;
      if (name.includes("Booking")) return { createQueryBuilder: vi.fn().mockReturnValue(bookingQuery) } as any;
      if (name.includes("ClassSession")) return { createQueryBuilder: vi.fn().mockReturnValue(sessionQuery) } as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await AdminDashboardController.get(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      tenant_id: "tenant-1",
      report_timezone: "Europe/Istanbul",
      quick_setup: {
        steps: {
          clinic: true,
          package: true,
          working_hours: true,
          clinic_qr: true,
          dashboard_preview: true,
        },
        completed: 5,
        total: 5,
        is_complete: true,
      },
      kpis: {
        active_trainers: 3,
        active_members: 25,
        at_risk_members: 1,
        todays_bookings: 9,
        todays_sessions: 4,
      },
      leads: {
        total: 12,
        by_status: {
          NEW: 4,
          CONTACTED: 3,
          WON: 2,
          LOST: 1,
        },
      },
      packages: {
        total: 8,
        active: 6,
        visible_active: 5,
        public_active: 4,
      },
      revenue: {
        daily: 1200.5,
        weekly: 5400.25,
        monthly: 18200.75,
        yearly: 98600,
      },
      package_sales: {
        weekly_credits_sold: 24,
        monthly_credits_sold: 88,
        weekly_package_count: 0,
        monthly_package_count: 0,
        yearly_package_count: 0,
        weekly_pack_8_count: 2,
        weekly_pack_4_count: 1,
        monthly_pack_8_count: 6,
        monthly_pack_4_count: 4,
        yearly_pack_8_count: 40,
        yearly_pack_4_count: 22,
      },
      risk_preview: [{ member_id: "member-9", risk_score: 81 }],
      spotlight: {
        trainers: [{ id: "trainer-1", first_name: "Ece", last_name: "Kara", email: "ece@example.com", is_active: true }],
        members: [{ id: "member-1", first_name: "Ada", last_name: "Yilmaz", email: "ada@example.com", is_active: true }],
      },
    });
  });

  it("rejects dashboard access when tenant is missing", async () => {
    const req = {} as any;
    const res = createMockResponse();

    await expect(AdminDashboardController.get(req, res as any)).rejects.toMatchObject({
      code: "NO_TENANT",
      statusCode: 400,
    });
  });
});
