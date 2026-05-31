import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberPackagesController } from "../controllers/member/packages.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("member packages controller", () => {
  afterEach(() => {
    vi.useRealTimers();
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
    const bookingRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndMapOne: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      }),
    };
    const notificationEventRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("NotificationEvent")) return notificationEventRepo as any;
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
  });

  it("links pending group class requests when notification payload is JSON text", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T09:00:00.000Z"));

    const userPackageRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndMapOne: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          {
            id: "up-1",
            package_id: "pkg-1",
            remaining_credits: 8,
            is_active: true,
            created_at: "2026-04-20T09:00:00.000Z",
            starts_at: "2026-04-20T09:00:00.000Z",
            expires_at: "2026-05-20T09:00:00.000Z",
            packageDetails: { id: "pkg-1", title: "Group Pack", type: "GROUP", total_credits: 8, display_price: 4200 },
          },
        ]),
      }),
    };
    const bookingRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndMapOne: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      }),
    };
    const notificationEventRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          {
            id: "evt-1",
            payload: JSON.stringify({
              package_id: "pkg-1",
              selected_sub_lesson: "Mat Pilates",
              selected_days: [
                {
                  group_class_id: "session-1",
                  starts_at: "2026-04-24T09:00:00.000Z",
                  ends_at: "2026-04-24T10:00:00.000Z",
                },
              ],
            }),
          },
        ]),
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("NotificationEvent")) return notificationEventRepo as any;
      return {} as any;
    });

    const res = createMockResponse();
    await MemberPackagesController.listMyPackages(
      { tenantId: "tenant-1", auth: { sub: "member-1", accountId: "account-1" } } as any,
      res as any
    );

    expect(res.body.data[0].linked_group_classes).toEqual([
      expect.objectContaining({
        request_id: "evt-1",
        session_id: "session-1",
        title: "Mat Pilates",
        status: "PENDING",
      }),
    ]);
  });
});
