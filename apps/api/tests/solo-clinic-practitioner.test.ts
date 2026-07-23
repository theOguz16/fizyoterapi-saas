import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBookingsController } from "../controllers/admin/bookings.controller";
import { AdminPackageTrainersController } from "../controllers/admin/package-trainers.controller";
import { AppDataSource } from "../data-source";
import { Booking } from "../entities/booking.entity";
import { Package } from "../entities/package.entity";
import { PackageTrainerAssignment } from "../entities/package-trainer-assignment.entity";
import { User, UserRole } from "../entities/user.entity";
import { AuditLogService } from "../services/audit-log.service";
import { BookingScheduleGuardService } from "../services/booking-schedule-guard.service";
import { createMockResponse } from "./helpers/route-chain";

describe("solo clinic owner practitioner flows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the owner trainer identity for package assignment", async () => {
    const assignmentRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((input) => ({ id: "assignment-1", ...input })),
      save: vi.fn(async (input) => input),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Package) return { findOne: vi.fn().mockResolvedValue({ id: "package-1" }) } as any;
      if (entity === User) {
        return {
          findOne: vi.fn().mockResolvedValue({ id: "owner-trainer", role: UserRole.TRAINER, is_active: true }),
        } as any;
      }
      if (entity === PackageTrainerAssignment) return assignmentRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const res = createMockResponse();
    await AdminPackageTrainersController.create(
      {
        tenantId: "tenant-1",
        auth: { accountId: "account-1", role: UserRole.ADMIN },
        body: { package_id: "package-1", trainer_id: "owner-trainer" },
        method: "POST",
        originalUrl: "/api/admin/package-trainers",
        headers: {},
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        package_id: "package-1",
        trainer_id: "owner-trainer",
        is_active: true,
      })
    );
  });

  it("accepts the owner trainer identity for booking and calendar creation", async () => {
    const bookingRepo = {
      create: vi.fn((input) => Object.assign(new Booking(), input)),
      save: vi.fn(async (booking: Booking) => {
        booking.id = "booking-1";
        return booking;
      }),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === User) {
        return {
          findOne: vi.fn(async ({ where }: any) => ({ id: where.id, role: where.role, is_active: true })),
        } as any;
      }
      if (entity === Booking) return bookingRepo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) =>
      callback({
        getRepository: (entity: any) => {
          if (entity === Booking) return bookingRepo;
          throw new Error(`Unexpected transaction repository: ${String(entity?.name || entity)}`);
        },
      })
    );
    vi.spyOn(BookingScheduleGuardService, "ensureAvailable").mockResolvedValue(undefined);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const res = createMockResponse();
    await AdminBookingsController.create(
      {
        tenantId: "tenant-1",
        auth: { accountId: "account-1", role: UserRole.ADMIN },
        body: {
          member_id: "member-1",
          trainer_id: "owner-trainer",
          starts_at: "2026-08-01T10:00:00.000Z",
          ends_at: "2026-08-01T11:00:00.000Z",
        },
        method: "POST",
        originalUrl: "/api/admin/bookings",
        headers: {},
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(bookingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        member_id: "member-1",
        trainer_id: "owner-trainer",
      })
    );
    expect(BookingScheduleGuardService.ensureAvailable).toHaveBeenCalledOnce();
  });
});
