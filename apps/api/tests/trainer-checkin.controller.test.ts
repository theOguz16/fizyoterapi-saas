import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerCheckinController } from "../controllers/trainer/checkin.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";
import { MobileNotificationService } from "../services/mobile-notification.service";

describe("trainer checkin controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects manual check-in when neither member_id nor manual_code is provided", async () => {
    const req = {
      tenantId: "tenant-1",
      body: {},
    } as any;
    const res = createMockResponse();

    await expect(TrainerCheckinController.checkinManual(req, res as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("rejects qr check-in when qr_code is missing", async () => {
    const req = {
      tenantId: "tenant-1",
      body: {},
    } as any;
    const res = createMockResponse();

    await expect(TrainerCheckinController.checkinByQr(req, res as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("returns member not found for unresolved manual identifiers", async () => {
    const userRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      body: { manual_code: "unknown@example.com" },
    } as any;
    const res = createMockResponse();

    await expect(TrainerCheckinController.checkinManual(req, res as any)).rejects.toMatchObject({
      code: "MEMBER_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("prioritizes the booked package for session check-in over mismatched qr-selected package", async () => {
    const member = {
      id: "member-1",
      tenant_id: "tenant-1",
      role: "MEMBER",
      is_active: true,
    } as any;
    const bookedUserPackage = {
      id: "up-booked",
      package_id: "pkg-booked",
      remaining_credits: 2,
    } as any;
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(member),
    };
    const userPackageRepo = {
      findOne: vi.fn().mockResolvedValue(bookedUserPackage),
      save: vi.fn(async (row) => row),
    };
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "booking-1",
        tenant_id: "tenant-1",
        checkin_status: "PENDING",
        meta: {},
      }),
      save: vi.fn(async (row) => row),
    };
    const attendanceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((row) => ({ id: "attendance-1", ...row })),
      save: vi.fn(async (row) => row),
    };

    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback) =>
      callback({
        getRepository: (entity: { name?: string }) => {
          const name = entity?.name || "";
          if (name.includes("Booking")) return bookingRepo;
          if (name.includes("Attendance")) return attendanceRepo;
          if (name.includes("UserPackage")) return userPackageRepo;
          return { findOne: vi.fn(), save: vi.fn(async (row) => row) };
        },
      } as never)
    );

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("User")) return userRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Booking")) return bookingRepo as any;
      return { save: vi.fn(async (row) => row) } as any;
    });

    vi.spyOn(TrainerCheckinController as any, "ensurePaymentApprovalForSessionCheckin").mockResolvedValue({
      booking: { id: "booking-1", meta: { package_id: "pkg-booked" } },
      session: { id: "session-1", related_package_id: null, lesson_category: "PT" },
    });
    vi.spyOn(TrainerCheckinController as any, "findRecentDuplicate").mockResolvedValue(null);
    vi.spyOn(TrainerCheckinController as any, "findDeductablePackageById").mockResolvedValue({
      id: "up-other",
      package_id: "pkg-other",
      remaining_credits: 4,
    });
    vi.spyOn(TrainerCheckinController as any, "findDeductablePackageByPackageId").mockResolvedValue(bookedUserPackage);
    vi.spyOn(TrainerCheckinController as any, "persistAttendance").mockResolvedValue({
      id: "attendance-1",
    });
    vi.spyOn(TrainerCheckinController as any, "logCheckinAudit").mockResolvedValue(undefined);
    vi.spyOn(TrainerCheckinController as any, "applyLoyaltyCampaignRewards").mockResolvedValue(undefined);
    vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1" },
      body: { qr_code: "MEM-ABC::UP::up-other", session_id: "session-1" },
    } as any;
    const res = createMockResponse();

    await TrainerCheckinController.checkinByQr(req, res as any);

    expect(userPackageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "up-booked",
        remaining_credits: 1,
      })
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          userPackageId: "up-booked",
          remainingCredits: 1,
        }),
      })
    );
  });
});
