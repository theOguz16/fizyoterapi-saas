import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { MobilePurchaseSyncService } from "../services/mobile-purchase-sync.service";
import { AutomaticBookingSchedulerService } from "../services/automatic-booking-scheduler.service";

describe("mobile purchase sync service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to package trainer assignment when purchase context has no trainer_id", async () => {
    const memberUser = {
      id: "member-1",
      weekly_class_hours: 1,
    } as any;

    const packageRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "pkg-1",
          tenant_id: "tenant-1",
          title: "Reformer",
          total_credits: 8,
          duration_days: 28,
          display_price: "700",
          rules: {},
        },
      ]),
    };
    const userRepo = {
      save: vi.fn().mockResolvedValue(memberUser),
      findOne: vi.fn().mockResolvedValue({
        id: "trainer-1",
        first_name: "Ece",
        last_name: "Yilmaz",
      }),
    };
    const userPackageRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((value) => value),
      save: vi.fn().mockResolvedValue({}),
    };
    const availabilityRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({}),
      }),
      create: vi.fn().mockImplementation((value) => value),
      save: vi.fn().mockResolvedValue([]),
    };
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation((value) => value),
      save: vi.fn().mockResolvedValue({}),
    };
    const sessionRepo = {
      find: vi.fn().mockResolvedValue([]),
    };
    const assignmentRepo = {
      findOne: vi.fn().mockResolvedValue({
        package_id: "pkg-1",
        trainer_id: "trainer-1",
        is_active: true,
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "Package") return packageRepo as any;
      if (name === "User") return userRepo as any;
      if (name === "UserPackage") return userPackageRepo as any;
      if (name === "Availability") return availabilityRepo as any;
      if (name === "Booking") return bookingRepo as any;
      if (name === "ClassSession") return sessionRepo as any;
      if (name === "PackageTrainerAssignment") return assignmentRepo as any;
      throw new Error(`Unexpected repository: ${name}`);
    });
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback({}));
    const scheduleSpy = vi
      .spyOn(AutomaticBookingSchedulerService, "schedule")
      .mockResolvedValue([] as any);

    const result = await MobilePurchaseSyncService.applyApprovedPurchaseContext({
      tenantId: "tenant-1",
      memberUser,
      requestId: "request-1",
      context: {
        package_id: "pkg-1",
        package_ids: ["pkg-1"],
        package_title: "Reformer",
        selected_days: [
          {
            starts_at: "2030-02-11T09:00:00.000Z",
            ends_at: "2030-02-11T10:00:00.000Z",
            label: "Pazartesi 09:00",
          },
          {
            starts_at: "2030-02-12T09:00:00.000Z",
            ends_at: "2030-02-12T10:00:00.000Z",
            label: "Salı 09:00",
          },
          {
            starts_at: "2030-02-13T09:00:00.000Z",
            ends_at: "2030-02-13T10:00:00.000Z",
            label: "Çarşamba 09:00",
          },
        ],
      },
    });

    expect(assignmentRepo.findOne).toHaveBeenCalledWith({
      where: {
        tenant_id: "tenant-1",
        package_id: "pkg-1",
        is_active: true,
      },
    });
    expect(scheduleSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tenantId: "tenant-1",
        memberId: "member-1",
        trainerId: "trainer-1",
        requestId: "request-1",
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        trainer_id: "trainer-1",
        trainer_name: "Ece Yilmaz",
        selected_slot_count: 3,
      })
    );
  });

  it("normalizes purchase context from JSON text payloads", () => {
    const context = MobilePurchaseSyncService.normalizePurchaseContext(
      JSON.stringify({
        package_id: "pkg-1",
        package_title: "Starter",
        selected_days: [
          {
            starts_at: "2026-05-12T09:00:00.000Z",
            ends_at: "2026-05-12T10:00:00.000Z",
          },
        ],
      })
    );

    expect(context).toEqual(
      expect.objectContaining({
        package_id: "pkg-1",
        package_ids: ["pkg-1"],
        package_title: "Starter",
        selected_days: [
          expect.objectContaining({
            starts_at: "2026-05-12T09:00:00.000Z",
          }),
        ],
      })
    );
  });

  it("resolves purchase context from notification events with JSON text payloads", async () => {
    const eventQuery = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({
        payload: JSON.stringify({
          package_id: "pkg-2",
          package_title: "Reformer",
          selected_days: [
            {
              starts_at: "2026-05-13T09:00:00.000Z",
              ends_at: "2026-05-13T10:00:00.000Z",
            },
          ],
        }),
      }),
    };
    const notificationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(eventQuery),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "NotificationEvent") return notificationRepo as any;
      throw new Error(`Unexpected repository: ${name}`);
    });

    const context = await MobilePurchaseSyncService.resolvePurchaseContext({
      id: "application-1",
      tenant_id: "tenant-1",
      note: "",
    } as any);

    expect(context).toEqual(
      expect.objectContaining({
        package_id: "pkg-2",
        package_title: "Reformer",
      })
    );
  });
});
