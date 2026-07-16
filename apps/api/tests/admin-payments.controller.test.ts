import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPaymentsController } from "../controllers/admin/payments.controller";
import { AppDataSource } from "../data-source";
import { Booking, BookingPaymentStatus } from "../entities/booking.entity";
import { UserPackage } from "../entities/user-package.entity";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

function createRevenueQuery(rows: Array<Record<string, unknown>> = []) {
  const query: Record<string, any> = {};
  for (const method of [
    "innerJoin",
    "leftJoin",
    "select",
    "addSelect",
    "where",
    "andWhere",
    "orderBy",
  ]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.getRawMany = vi.fn().mockResolvedValue(rows);
  return query;
}

function paymentRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    tenant_id: "tenant-1",
    member_id: "member-1",
    trainer_id: "trainer-1",
    payment_status: BookingPaymentStatus.REQUESTED,
    payment_note: "initial note",
    ...overrides,
  } as Booking;
}

describe("admin payments controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps revenue queries tenant scoped and aggregates package totals", async () => {
    const rows = [
      {
        id: "sale-1",
        created_at: new Date("2026-07-01T10:00:00.000Z"),
        member_id: "member-1",
        member_name: "Ayse Yilmaz",
        package_id: "package-1",
        package_title: "Starter",
        package_type: "INDIVIDUAL",
        amount: "1200.50",
        credits: "8",
      },
      {
        id: "sale-2",
        created_at: new Date("2026-07-02T10:00:00.000Z"),
        member_id: "member-2",
        member_name: "Mehmet Kaya",
        package_id: "package-1",
        package_title: "Starter",
        package_type: "INDIVIDUAL",
        amount: "799.50",
        credits: "4",
      },
    ];
    const query = createRevenueQuery(rows);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === UserPackage) return { createQueryBuilder: vi.fn().mockReturnValue(query) } as any;
      throw new Error(`Unexpected repository: ${entity?.name || entity}`);
    });
    const res = createMockResponse();

    await AdminPaymentsController.revenueReport(
      {
        tenantId: "tenant-1",
        query: {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-07-31T23:59:59.000Z",
          package_id: "package-1",
          trainer_id: "trainer-1",
        },
      } as any,
      res as any
    );

    expect(query.where).toHaveBeenCalledWith("up.tenant_id = :tenantId", { tenantId: "tenant-1" });
    expect(query.andWhere).toHaveBeenCalledWith("up.package_id = :packageId", { packageId: "package-1" });
    expect(query.andWhere).toHaveBeenCalledWith("pta.trainer_id = :trainerId", { trainerId: "trainer-1" });
    expect(res.body).toEqual({
      data: expect.objectContaining({
        total_revenue: 2000,
        sale_count: 2,
        average_sale: 1000,
        by_package: [
          {
            package_id: "package-1",
            package_title: "Starter",
            amount: 2000,
            count: 2,
          },
        ],
      }),
    });
  });

  it("rejects missing tenant context and malformed revenue dates", async () => {
    await expect(
      AdminPaymentsController.revenueReport({ tenantId: null, query: {} } as any, createMockResponse() as any)
    ).rejects.toMatchObject({ code: "NO_TENANT", statusCode: 400 });

    await expect(
      AdminPaymentsController.revenueReport(
        { tenantId: "tenant-1", query: { from: "not-a-date" } } as any,
        createMockResponse() as any
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
  });

  it("does not approve a payment request belonging to another tenant", async () => {
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Booking) return bookingRepo as any;
      throw new Error(`Unexpected repository: ${entity?.name || entity}`);
    });
    const audit = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    await expect(
      AdminPaymentsController.approveRequest(
        {
          tenantId: "tenant-1",
          auth: { sub: "admin-1", role: "ADMIN" },
          params: { bookingId: "tenant-2-booking" },
          body: {},
        } as any,
        createMockResponse() as any
      )
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", statusCode: 404 });

    expect(bookingRepo.findOne).toHaveBeenCalledWith({
      where: { id: "tenant-2-booking", tenant_id: "tenant-1" },
    });
    expect(bookingRepo.save).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("approves a tenant payment request and records actor-safe audit context", async () => {
    const booking = paymentRequest();
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(booking),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(bookingRepo as any);
    const audit = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    const res = createMockResponse();

    await AdminPaymentsController.approveRequest(
      {
        tenantId: "tenant-1",
        auth: {
          sub: "legacy-admin-user",
          linkedUserId: "admin-user-1",
          accountId: "account-1",
          role: "ADMIN",
        },
        params: { bookingId: "booking-1" },
        body: { payment_note: "  bank transfer confirmed  " },
        method: "PATCH",
        originalUrl: "/api/admin/payments/requests/booking-1/approve",
        headers: {},
      } as any,
      res as any
    );

    expect(booking.payment_status).toBe(BookingPaymentStatus.APPROVED);
    expect(booking.payment_approved_at).toBeInstanceOf(Date);
    expect(booking.payment_approved_by_admin_id).toBe("legacy-admin-user");
    expect(booking.payment_note).toBe("bank transfer confirmed");
    expect(bookingRepo.save).toHaveBeenCalledWith(booking);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        actor_user_id: "admin-user-1",
        actor_account_id: "account-1",
        event_type: "ADMIN_PAYMENT_APPROVED",
        target_id: "booking-1",
        metadata: {
          payment_status: BookingPaymentStatus.APPROVED,
          member_id: "member-1",
          trainer_id: "trainer-1",
        },
      })
    );
    expect(res.body).toEqual({ data: booking });
  });

  it("rejects a payment request and clears prior approval fields", async () => {
    const booking = paymentRequest({
      payment_status: BookingPaymentStatus.APPROVED,
      payment_approved_at: new Date("2026-07-01T10:00:00.000Z"),
      payment_approved_by_admin_id: "admin-old",
    });
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(booking),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(bookingRepo as any);
    const audit = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    await AdminPaymentsController.rejectRequest(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", role: "ADMIN" },
        params: { bookingId: "booking-1" },
        body: { payment_note: "insufficient receipt" },
        method: "PATCH",
        originalUrl: "/api/admin/payments/requests/booking-1/reject",
        headers: {},
      } as any,
      createMockResponse() as any
    );

    expect(booking.payment_status).toBe(BookingPaymentStatus.REJECTED);
    expect(booking.payment_approved_at).toBeUndefined();
    expect(booking.payment_approved_by_admin_id).toBeUndefined();
    expect(booking.payment_note).toBe("insufficient receipt");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        event_type: "ADMIN_PAYMENT_REJECTED",
        target_id: "booking-1",
      })
    );
  });
});
