import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberPackagesController } from "../controllers/member/packages.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("member packages controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists visible active packages for the member catalog", async () => {
    const packageRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "pkg-1",
          title: "Starter",
          type: "LESSON",
          total_credits: 8,
          duration_days: 30,
          capacity: 1,
          display_price: 4200,
        },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Package")) return packageRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await MemberPackagesController.list(req, res as any);

    expect(packageRepo.find).toHaveBeenCalledWith({
      where: { tenant_id: "tenant-1", is_active: true, is_visible: true },
      order: { created_at: "DESC" },
    });
    expect(res.body).toEqual({
      data: [
        {
          id: "pkg-1",
          title: "Starter",
          type: "LESSON",
          total_credits: 8,
          duration_days: 30,
          capacity: 1,
          display_price: 4200,
        },
      ],
    });
  });

  it("maps owned packages into upcoming, active and expired states", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T09:00:00.000Z"));

    const queryBuilder = {
      leftJoinAndMapOne: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        {
          id: "up-1",
          remaining_credits: 8,
          is_active: true,
          created_at: "2026-04-20T09:00:00.000Z",
          starts_at: "2026-04-25T09:00:00.000Z",
          expires_at: "2026-05-25T09:00:00.000Z",
          packageDetails: { title: "Future Pack", type: "LESSON", total_credits: 8, display_price: 4200 },
        },
        {
          id: "up-2",
          remaining_credits: 4,
          is_active: true,
          created_at: "2026-04-01T09:00:00.000Z",
          starts_at: "2026-04-02T09:00:00.000Z",
          expires_at: "2026-05-02T09:00:00.000Z",
          packageDetails: { title: "Active Pack", type: "LESSON", total_credits: 8, display_price: 4200 },
        },
        {
          id: "up-3",
          remaining_credits: 0,
          is_active: true,
          created_at: "2026-03-01T09:00:00.000Z",
          starts_at: "2026-03-02T09:00:00.000Z",
          expires_at: "2026-04-01T09:00:00.000Z",
          packageDetails: { title: "Expired Pack", type: "LESSON", total_credits: 8, display_price: 4200 },
        },
      ]),
    };
    const userPackageRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("UserPackage")) return userPackageRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1", auth: { sub: "member-1" } } as any;
    const res = createMockResponse();

    await MemberPackagesController.listMyPackages(req, res as any);

    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          id: "up-1",
          status: "UPCOMING",
          package_title: "Future Pack",
          package_id: undefined,
          renewal_price: 4200,
          renewal_price_changed: false,
        }),
        expect.objectContaining({
          id: "up-2",
          status: "ACTIVE",
          package_title: "Active Pack",
          package_id: undefined,
          renewal_price: 4200,
          renewal_price_changed: false,
        }),
        expect.objectContaining({
          id: "up-3",
          status: "EXPIRED",
          package_title: "Expired Pack",
          package_id: undefined,
          renewal_price: 4200,
          renewal_price_changed: false,
        }),
      ],
    });
    vi.useRealTimers();
  });
});
