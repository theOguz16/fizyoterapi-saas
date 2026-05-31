import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMobileApprovalsController } from "../controllers/admin/mobile-approvals.controller";
import { MemberMobileRequestsController } from "../controllers/member/mobile-requests.controller";
import { PublicInvitesController } from "../controllers/public-invites.controller";
import { AppDataSource } from "../data-source";
import { BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { InviteStatus } from "../entities/invite.entity";
import { UserRole } from "../entities/user.entity";
import { AuditLogService } from "../services/audit-log.service";
import { MemberRequestCleanupService } from "../services/member-request-cleanup.service";
import { MobileNotificationService } from "../services/mobile-notification.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { createMockResponse } from "./helpers/route-chain";
import crypto from "crypto";

function repoName(entity: any) {
  return typeof entity === "function" ? entity.name : String(entity);
}

function createRepo<T extends { id?: string }>(rows: T[] = []) {
  return {
    rows,
    find: vi.fn(async (options?: any) => {
      if (!options?.where) return rows;
      const wheres = Array.isArray(options.where) ? options.where : [options.where];
      return rows.filter((row: any) =>
        wheres.some((where: any) =>
          Object.entries(where).every(([key, value]) => value === undefined || row[key] === value)
        )
      );
    }),
    findOne: vi.fn(async (options?: any) => {
      if (!options?.where) return rows[0] || null;
      const wheres = Array.isArray(options.where) ? options.where : [options.where];
      return (
        rows.find((row: any) =>
          wheres.some((where: any) =>
            Object.entries(where).every(([key, value]) => value === undefined || row[key] === value)
          )
        ) || null
      );
    }),
    create: vi.fn((value: T) => ({ ...value, id: value.id || `row-${rows.length + 1}` })),
    save: vi.fn(async (value: T) => {
      const row = value as T;
      if (!row.id) row.id = `row-${rows.length + 1}`;
      const index = rows.findIndex((item) => item.id === row.id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    }),
    count: vi.fn(async () => rows.length),
  };
}

function createDeleteQueryBuilder() {
  return {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({}),
  };
}

function createUserPackageQueryBuilder(rows: any[]) {
  const params: Record<string, any> = {};
  const builder = {
    where: vi.fn((_sql: string, next: Record<string, any>) => {
      Object.assign(params, next);
      return builder;
    }),
    andWhere: vi.fn((_sql: string, next: Record<string, any>) => {
      Object.assign(params, next);
      return builder;
    }),
    getMany: vi.fn(async () =>
      rows.filter((row) => {
        if (params.tenantId && row.tenant_id !== params.tenantId) return false;
        if (params.userId && row.user_id !== params.userId) return false;
        if (Array.isArray(params.packageIds) && !params.packageIds.includes(row.package_id)) return false;
        if (Array.isArray(params.sourceRequestIds) && !params.sourceRequestIds.includes(row.source_request_id)) return false;
        if (params.sourceRequestId && row.source_request_id !== params.sourceRequestId) return false;
        return true;
      })
    ),
  };
  return builder;
}

describe("duo package flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("splits the first payment, creates partner invite, accepts partner invite and activates both duo calendars after second approval", async () => {
    vi.stubEnv("WEB_URL", "https://fizyoflow.test");
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (tenant: any) => tenant);
    vi.spyOn(MemberRequestCleanupService, "cleanupStaleApplicationsForAccount").mockResolvedValue(undefined as never);
    vi.spyOn(MemberRequestCleanupService, "findActionablePaymentRequest").mockResolvedValue(null as never);
    const queuePushSpy = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: true, count: 1, failedCount: 0, eventId: "push-1" } as never);

    const accountRows: any[] = [
      {
        id: "acc-primary",
        email: "primary@example.com",
        first_name: "Primary",
        last_name: "Member",
      },
    ];
    const tenantRows: any[] = [
      {
        id: "tenant-1",
        slug: "demo-salon",
        name: "Demo Salon",
        is_active: true,
        is_public: true,
        review_status: "PUBLISHED",
        subscription_status: "ACTIVE",
      },
    ];
    const membershipRows: any[] = [
      {
        id: "membership-primary",
        tenant_id: "tenant-1",
        account_id: "acc-primary",
        user_id: "member-primary",
        status: "ACTIVE",
        is_active_context: true,
      },
    ];
    const packageRows: any[] = [
      {
        id: "pkg-duo",
        tenant_id: "tenant-1",
        title: "Duo Reformer",
        type: "REFORMER",
        total_credits: 8,
        duration_days: 30,
        capacity: 2,
        display_price: "10000",
        is_active: true,
        rules: { lesson_mode: "DUO", weekly_class_hours: 1, lesson_category: "REFORMER" },
      },
    ];
    const notificationRows: any[] = [];
    const applicationRows: any[] = [];
    const inviteRows: any[] = [];
    const userRows: any[] = [
      {
        id: "member-primary",
        tenant_id: "tenant-1",
        email: "primary@example.com",
        first_name: "Primary",
        last_name: "Member",
        role: UserRole.MEMBER,
        weekly_class_hours: 1,
      },
      {
        id: "trainer-1",
        tenant_id: "tenant-1",
        email: "trainer@example.com",
        first_name: "Trainer",
        last_name: "One",
        role: UserRole.TRAINER,
      },
    ];
    const userPackageRows: any[] = [];
    const bookingRows: any[] = [];

    const repos: Record<string, any> = {
      Account: createRepo(accountRows),
      Tenant: createRepo(tenantRows),
      SalonMembership: createRepo(membershipRows),
      Package: createRepo(packageRows),
      SalonApplication: createRepo(applicationRows),
      NotificationEvent: createRepo(notificationRows),
      Invite: createRepo(inviteRows),
      User: createRepo(userRows),
      UserPackage: createRepo(userPackageRows),
      Booking: createRepo(bookingRows),
      ClassSession: createRepo([]),
      PackageTrainerAssignment: createRepo([{ id: "assign-1", tenant_id: "tenant-1", package_id: "pkg-duo", trainer_id: "trainer-1", is_active: true }]),
      Availability: {
        ...createRepo([]),
        createQueryBuilder: vi.fn(createDeleteQueryBuilder),
      },
    };

    repos.NotificationEvent.create = vi.fn((value: any) => ({
      ...value,
      id: value.id || `evt-${notificationRows.length + 1}`,
      created_at: value.created_at || new Date("2026-05-10T09:00:00.000Z"),
    }));
    repos.Invite.create = vi.fn((value: any) => ({
      ...value,
      id: value.id || `invite-${inviteRows.length + 1}`,
      created_at: value.created_at || new Date("2026-05-10T09:00:00.000Z"),
    }));
    repos.User.create = vi.fn((value: any) => ({
      ...value,
      id: value.email === "partner@example.com" ? "member-partner" : value.id || `user-${userRows.length + 1}`,
    }));
    repos.Account.create = vi.fn((value: any) => ({
      ...value,
      id: value.email === "partner@example.com" ? "acc-partner" : value.id || `acc-${accountRows.length + 1}`,
    }));
    repos.SalonMembership.create = vi.fn((value: any) => ({
      ...value,
      id: value.account_id === "acc-partner" ? "membership-partner" : value.id || `membership-${membershipRows.length + 1}`,
    }));
    repos.UserPackage.create = vi.fn((value: any) => ({ ...value, id: value.id || `up-${userPackageRows.length + 1}` }));
    repos.UserPackage.createQueryBuilder = vi.fn(() => createUserPackageQueryBuilder(userPackageRows));
    repos.Booking.create = vi.fn((value: any) => ({ ...value, id: value.id || `booking-${bookingRows.length + 1}` }));

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = repoName(entity);
      const repo = repos[name];
      if (!repo) throw new Error(`Unexpected repository ${name}`);
      return repo;
    });

    const purchaseRes = createMockResponse();
    await MemberMobileRequestsController.createPaymentRequest(
      {
        auth: { accountId: "acc-primary", sub: "member-primary" },
        body: {
          tenant_slug: "demo-salon",
          package_id: "pkg-duo",
          trainer_id: "trainer-1",
          duo_partner_name: "Partner Member",
          duo_partner_contact: "partner@example.com",
          selected_days: [
            {
              starts_at: "2026-05-11T09:00:00.000Z",
              ends_at: "2026-05-11T10:00:00.000Z",
              label: "Pazartesi 09:00",
            },
          ],
        },
        method: "POST",
        originalUrl: "/api/member/purchase-requests",
        headers: {},
      } as any,
      purchaseRes as any
    );

    expect(purchaseRes.statusCode).toBe(201);
    expect(purchaseRes.body).toMatchObject({
      data: {
        amount: 5000,
        duo_payment: expect.objectContaining({
          primary_amount: 5000,
          partner_amount: 5000,
          status: "AWAITING_PARTNER_PAYMENT",
        }),
      },
    });
    const primaryPaymentEvent = notificationRows[0];
    expect(primaryPaymentEvent.payload).toMatchObject({
      lesson_mode: "DUO",
      amount: 5000,
      total_package_amount: 10000,
      duo_partner_contact: "partner@example.com",
    });

    const primaryApprovalRes = createMockResponse();
    await AdminMobileApprovalsController.decide(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", role: "ADMIN" },
        params: { id: `payment:${primaryPaymentEvent.id}` },
        body: { decision: "APPROVE" },
        method: "PATCH",
        originalUrl: `/api/admin/mobile-approvals/payment:${primaryPaymentEvent.id}`,
        headers: {},
      } as any,
      primaryApprovalRes as any
    );

    expect(primaryApprovalRes.body).toEqual({
      data: { id: `payment:${primaryPaymentEvent.id}`, type: "PAYMENT", status: "APPROVED" },
    });
    expect(inviteRows).toHaveLength(1);
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-primary",
        type: "DUO_INVITE_SENT",
      })
    );
    expect(inviteRows[0]).toMatchObject({
      role: UserRole.MEMBER,
      email_or_phone: "partner@example.com",
      status: InviteStatus.PENDING,
      meta: expect.objectContaining({
        kind: "DUO_PARTNER",
        primary_payment_event_id: primaryPaymentEvent.id,
      }),
    });
    expect(userPackageRows[0]).toMatchObject({
      user_id: "member-primary",
      package_id: "pkg-duo",
      is_active: false,
      package_snapshot: expect.objectContaining({
        duo: expect.objectContaining({
          status: "AWAITING_PARTNER_PAYMENT",
          invite_url: expect.stringContaining("/invite/accept?token="),
        }),
      }),
    });
    expect(bookingRows[0]).toMatchObject({
      member_id: "member-primary",
      trainer_id: "trainer-1",
      status: BookingStatus.PENDING,
      payment_status: BookingPaymentStatus.REQUESTED,
      meta: expect.objectContaining({
        is_duo: true,
        duo: expect.objectContaining({ status: "AWAITING_PARTNER_PAYMENT" }),
      }),
    });

    const inviteToken = String(primaryPaymentEvent.payload.duo_invite_token);
    const acceptRes = createMockResponse();
    await PublicInvitesController.accept(
      {
        body: {
          token: inviteToken,
          first_name: "Partner",
          last_name: "Member",
          phone: "05551234567",
          email: "partner@example.com",
          password: "partner123",
        },
        method: "POST",
        originalUrl: "/api/public/invites/accept",
        headers: {},
      } as any,
      acceptRes as any
    );

    expect(acceptRes.statusCode).toBe(201);
    expect(inviteRows[0]).toMatchObject({
      status: InviteStatus.ACCEPTED,
      accepted_user_id: "member-partner",
    });
    const partnerPaymentEvent = notificationRows.find(
      (row) => row.payload?.request_type === "DUO_PARTNER_PAYMENT"
    );
    expect(partnerPaymentEvent).toMatchObject({
      member_id: "member-partner",
      payload: expect.objectContaining({
        amount: 5000,
        lesson_mode: "DUO",
        duo_primary_payment_event_id: primaryPaymentEvent.id,
      }),
    });
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-primary",
        type: "DUO_PARTNER_ACCEPTED",
      })
    );
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-partner",
        type: "DUO_PARTNER_PAYMENT_REQUESTED",
      })
    );

    const partnerApprovalRes = createMockResponse();
    await AdminMobileApprovalsController.decide(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", role: "ADMIN" },
        params: { id: `payment:${partnerPaymentEvent.id}` },
        body: { decision: "APPROVE" },
        method: "PATCH",
        originalUrl: `/api/admin/mobile-approvals/payment:${partnerPaymentEvent.id}`,
        headers: {},
      } as any,
      partnerApprovalRes as any
    );

    expect(partnerApprovalRes.body).toEqual({
      data: { id: `payment:${partnerPaymentEvent.id}`, type: "PAYMENT", status: "APPROVED" },
    });
    expect(userPackageRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: "member-primary",
          is_active: true,
          package_snapshot: expect.objectContaining({
            duo: expect.objectContaining({ status: "ACTIVE", partner_user_id: "member-partner" }),
          }),
        }),
        expect.objectContaining({
          user_id: "member-partner",
          is_active: true,
          package_snapshot: expect.objectContaining({
            duo: expect.objectContaining({ status: "ACTIVE", primary_member_user_id: "member-primary" }),
          }),
        }),
      ])
    );
    expect(bookingRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          member_id: "member-primary",
          status: BookingStatus.APPROVED,
          payment_status: BookingPaymentStatus.APPROVED,
          meta: expect.objectContaining({
            duo: expect.objectContaining({ status: "ACTIVE", partner_user_id: "member-partner" }),
          }),
        }),
        expect.objectContaining({
          member_id: "member-partner",
          trainer_id: "trainer-1",
          status: BookingStatus.APPROVED,
          payment_status: BookingPaymentStatus.APPROVED,
          meta: expect.objectContaining({
            primary_member_user_id: "member-primary",
            is_duo: true,
            duo: expect.objectContaining({ status: "ACTIVE" }),
          }),
        }),
      ])
    );
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-primary",
        type: "DUO_PACKAGE_ACTIVATED",
      })
    );
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-partner",
        type: "DUO_PACKAGE_ACTIVATED",
      })
    );
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "trainer-1",
        type: "DUO_BOOKING_ACTIVATED",
      })
    );
  });

  it("lets an existing account accept a duo partner invite without creating a duplicate account", async () => {
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);
    const queuePushSpy = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue({ queued: true, count: 1, failedCount: 0, eventId: "push-1" } as never);
    const token = "duo-existing-account-token";
    const passwordHash = "$2b$04$tffXPimuqTWk91fBtQzbHOIwBHIr9kqLwBJxmmXhGQ8KY/LRDO.y2";
    const accountRows: any[] = [
      {
        id: "acc-existing-partner",
        email: "partner@example.com",
        password_hash: passwordHash,
        first_name: "Existing",
        last_name: "Partner",
        phone: "05551234567",
        global_role_default: UserRole.MEMBER,
        is_active: true,
      },
    ];
    const userRows: any[] = [
      {
        id: "member-existing-partner",
        tenant_id: "old-tenant",
        email: "partner@example.com",
        password_hash: passwordHash,
        first_name: "Existing",
        last_name: "Partner",
        phone: "05551234567",
        role: UserRole.MEMBER,
        is_active: true,
      },
    ];
    const membershipRows: any[] = [
      {
        id: "membership-existing-partner",
        tenant_id: "tenant-1",
        account_id: "acc-existing-partner",
        user_id: null,
        role: UserRole.MEMBER,
        status: "LEFT",
        payment_status: "UNPAID",
        is_active_context: false,
      },
    ];
    const inviteRows: any[] = [
      {
        id: "invite-existing-partner",
        tenant_id: "tenant-1",
        role: UserRole.MEMBER,
        email_or_phone: "partner@example.com",
        token_hash: crypto.createHash("sha256").update(token).digest("hex"),
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        meta: {
          kind: "DUO_PARTNER",
          tenant_slug: "demo-salon",
          tenant_name: "Demo Salon",
          package_id: "pkg-duo",
          package_ids: ["pkg-duo"],
          package_title: "Duo Reformer",
          selected_packages: [{ package_id: "pkg-duo", package_title: "Duo Reformer", package_price: 5000 }],
          amount: 5000,
          total_package_amount: 10000,
          trainer_id: "trainer-1",
          selected_days: [{ starts_at: "2026-05-11T09:00:00.000Z", ends_at: "2026-05-11T10:00:00.000Z" }],
          primary_payment_event_id: "evt-primary",
        },
      },
    ];
    const notificationRows: any[] = [];
    const repos: Record<string, any> = {
      Account: createRepo(accountRows),
      User: createRepo(userRows),
      SalonMembership: createRepo(membershipRows),
      Invite: createRepo(inviteRows),
      NotificationEvent: createRepo(notificationRows),
    };
    repos.User.create = vi.fn((value: any) => ({ ...value, id: `user-${userRows.length + 1}` }));
    repos.Account.create = vi.fn((value: any) => ({ ...value, id: `acc-${accountRows.length + 1}` }));
    repos.SalonMembership.create = vi.fn((value: any) => ({ ...value, id: `membership-${membershipRows.length + 1}` }));
    repos.NotificationEvent.create = vi.fn((value: any) => ({ ...value, id: `evt-${notificationRows.length + 1}` }));
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = repoName(entity);
      const repo = repos[name];
      if (!repo) throw new Error(`Unexpected repository ${name}`);
      return repo;
    });

    const res = createMockResponse();
    await PublicInvitesController.accept(
      {
        body: {
          token,
          first_name: "Existing",
          last_name: "Partner",
          password: "partner123",
        },
        method: "POST",
        originalUrl: "/api/public/invites/accept",
        headers: {},
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(repos.Account.create).not.toHaveBeenCalled();
    expect(inviteRows[0]).toMatchObject({
      status: InviteStatus.ACCEPTED,
      accepted_user_id: "user-2",
    });
    expect(userRows[0]).toMatchObject({
      tenant_id: "old-tenant",
      email: "partner@example.com",
    });
    expect(userRows[1]).toMatchObject({
      tenant_id: "tenant-1",
      password_hash: passwordHash,
      is_active: true,
    });
    expect(membershipRows[0]).toMatchObject({
      user_id: "user-2",
      status: "ACTIVE",
      payment_status: "UNPAID",
      is_active_context: true,
    });
    expect(notificationRows[0]).toMatchObject({
      member_id: "user-2",
      payload: expect.objectContaining({
        account_id: "acc-existing-partner",
        active_membership_id: "membership-existing-partner",
        request_type: "DUO_PARTNER_PAYMENT",
        amount: 5000,
        lesson_mode: "DUO",
        duo_primary_payment_event_id: "evt-primary",
      }),
    });
    expect(queuePushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        type: "DUO_PARTNER_PAYMENT_REQUESTED",
      })
    );
  });
});
