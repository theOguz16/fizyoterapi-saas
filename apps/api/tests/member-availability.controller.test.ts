import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberAvailabilityController } from "../controllers/member/availability.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { SlotValidationContractService } from "../services/slot-validation-contract.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  many?: unknown[];
  one?: unknown;
}) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 0 }),
    orderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
  };
}

describe("member availability controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists availabilities with package labels", async () => {
    const availabilityRepo = {
      count: vi.fn().mockResolvedValue(1),
      find: vi.fn().mockResolvedValue([
        {
          id: "slot-1",
          package_id: "pkg-1",
          starts_at: new Date("2026-04-06T09:00:00.000Z"),
          ends_at: new Date("2026-04-06T10:00:00.000Z"),
        },
      ]),
    };
    const packageRepo = {
      find: vi.fn().mockResolvedValue([{ id: "pkg-1", title: "Starter", display_price: "4200 TL" }]),
    };
    const membershipRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "membership-1",
        account_id: "account-1",
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Availability")) return availabilityRepo as any;
      if (name.includes("Package")) return packageRepo as any;
      if (name.includes("SalonMembership")) return membershipRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1", auth: { sub: "member-1" } } as any;
    const res = createMockResponse();

    await MemberAvailabilityController.list(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          id: "slot-1",
          package_title: "Starter",
          package_display_price: "4200 TL",
        }),
      ],
    });
  });

  it("rejects weekly plan creation when slots span multiple ISO weeks", async () => {
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "salon-1", business_hours: null }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "member-1", weekly_class_hours: 1 }),
    };

    vi.spyOn(SlotValidationContractService, "normalizeBusinessHours").mockReturnValue({
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      start_time: "08:00",
      end_time: "22:00",
      lunch_break_start: null,
      lunch_break_end: null,
      slot_minutes: 60,
    } as any);
    vi.spyOn(SlotValidationContractService, "isWithinBusinessHours").mockReturnValue({ ok: true } as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: {
        slots: [
          { starts_at: "2026-04-06T09:00:00.000Z", ends_at: "2026-04-06T10:00:00.000Z" },
          { starts_at: "2026-04-13T09:00:00.000Z", ends_at: "2026-04-13T10:00:00.000Z" },
          { starts_at: "2026-04-13T11:00:00.000Z", ends_at: "2026-04-13T12:00:00.000Z" },
        ],
      },
    } as any;
    const res = createMockResponse();

    await expect(MemberAvailabilityController.create(req, res as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("creates a valid weekly plan and returns calculated weekly summary", async () => {
    const bookingLookupQuery = createQueryBuilderMock({ one: null });
    const existingAvailabilityQuery = createQueryBuilderMock({ many: [] });
    const availabilityRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(existingAvailabilityQuery),
      create: vi.fn((payload) => payload),
    };
    const bookingRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(bookingLookupQuery),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "salon-1", business_hours: null }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "member-1", weekly_class_hours: 1 }),
    };
    const packageRepo = {
      find: vi.fn().mockResolvedValue([{ id: "pkg-1" }]),
    };
    const userPackageRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(createQueryBuilderMock({
        many: [{ id: "up-1", package_id: "pkg-1" }],
      })),
    };
    const transactionAvailabilityRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }),
      create: vi.fn((payload) => payload),
      save: vi.fn().mockImplementation(async (rows) =>
        rows.map((row: any, index: number) => ({
          id: `slot-${index + 1}`,
          ...row,
        }))
      ),
    };

    vi.spyOn(SlotValidationContractService, "normalizeBusinessHours").mockReturnValue({
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6, 7],
      start_time: "08:00",
      end_time: "22:00",
      lunch_break_start: null,
      lunch_break_end: null,
      slot_minutes: 60,
    } as any);
    vi.spyOn(SlotValidationContractService, "isWithinBusinessHours").mockReturnValue({ ok: true } as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Availability")) return availabilityRepo as any;
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      if (name.includes("User") && !name.includes("Package")) return userRepo as any;
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("Package")) return packageRepo as any;
      return {} as any;
    });
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) =>
      callback({
        getRepository: () => transactionAvailabilityRepo,
      })
    );

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", role: "MEMBER" },
      body: {
        slots: [
          { starts_at: "2026-04-06T09:00:00.000Z", ends_at: "2026-04-06T10:00:00.000Z", package_id: "pkg-1" },
          { starts_at: "2026-04-07T09:00:00.000Z", ends_at: "2026-04-07T10:00:00.000Z", package_id: "pkg-1" },
          { starts_at: "2026-04-08T09:00:00.000Z", ends_at: "2026-04-08T10:00:00.000Z", package_id: "pkg-1" },
        ],
        mode: "APPEND",
      },
      method: "POST",
      originalUrl: "/api/member/availability",
      headers: { "user-agent": "vitest" },
      requestId: "req-availability-1",
      ip: "127.0.0.1",
    } as any;
    const res = createMockResponse();

    await MemberAvailabilityController.create(req, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      data: {
        items: [
          expect.objectContaining({ id: "slot-1" }),
          expect.objectContaining({ id: "slot-2" }),
          expect.objectContaining({ id: "slot-3" }),
        ],
        weekly_plan: {
          weekly_class_hours: 1,
          selected_slots: 3,
          trainer_free_slots: 3,
          required_slots: 3,
          required_trainer_free_slots: 2,
          is_valid: true,
          mode: "APPEND",
          message: "Haftalık müsaitlik planına yeni saatler eklendi",
        },
      },
    });
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });
});
