import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberGroupClassesController } from "../controllers/mobile/member-group-classes.controller";
import { AppDataSource } from "../data-source";
import { BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { GroupClassNotificationScope, SessionStatus, SessionType } from "../entities/class-session.entity";
import { NotificationEventStatus } from "../entities/notification-event.entity";
import { GroupClassService } from "../services/group-class.service";
import { createMockResponse } from "./helpers/route-chain";

function matchesWhere(row: Record<string, any>, where: Record<string, any>) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

describe("member group classes controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not show another member's queued join request as the current member state", async () => {
    const session = {
      id: "session-1",
      tenant_id: "tenant-1",
      type: SessionType.GROUP,
      status: SessionStatus.SCHEDULED,
      starts_at: new Date("2026-05-12T10:00:00.000Z"),
      ends_at: new Date("2026-05-12T11:00:00.000Z"),
      notification_scope: GroupClassNotificationScope.SALON_MEMBERS,
      related_package_id: "pkg-1",
      capacity: 10,
      title: "Group",
    };
    const otherMemberEvent = {
      id: "evt-other-member",
      member_id: "other-account",
      status: NotificationEventStatus.QUEUED,
      payload: {
        request_type: "GROUP_CLASS_JOIN",
        selected_days: [{ group_class_id: "session-1" }],
      },
    };
    const notificationFind = vi.fn(async (options: any) =>
      [otherMemberEvent].filter((row) => matchesWhere(row, options.where || {}))
    );

    vi.spyOn(GroupClassService, "attachCounts").mockResolvedValue([{ ...session, joined_count: 0 }] as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("SalonMembership")) return { findOne: vi.fn().mockResolvedValue({ id: "membership-1" }) } as any;
      if (name.includes("ClassSession")) {
        return {
          createQueryBuilder: vi.fn(() => ({
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue([session]),
          })),
        } as any;
      }
      if (name.includes("Booking")) return { find: vi.fn().mockResolvedValue([]) } as any;
      if (name.includes("NotificationEvent")) return { find: notificationFind } as any;
      if (name.includes("Package")) return { find: vi.fn().mockResolvedValue([{ id: "pkg-1", title: "Group Package" }]) } as any;
      return {} as any;
    });

    const res = createMockResponse();

    await MemberGroupClassesController.list(
      {
        tenantId: "tenant-1",
        auth: { sub: "member-1", accountId: "account-1" },
      } as any,
      res as any
    );

    expect(notificationFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ member_id: "account-1" }),
      })
    );
    expect(res.body.data[0].member_join_state).toBe("OPEN");
    expect(res.body.data[0].member_join_request_id).toBeNull();
  });

  it("detects existing queued join requests even when they are not the newest event", async () => {
    const session = {
      id: "session-1",
      tenant_id: "tenant-1",
      type: SessionType.GROUP,
      status: SessionStatus.SCHEDULED,
      starts_at: new Date("2026-05-12T10:00:00.000Z"),
      ends_at: new Date("2026-05-12T11:00:00.000Z"),
      notification_scope: GroupClassNotificationScope.SALON_MEMBERS,
      related_package_id: "pkg-1",
      capacity: 10,
      title: "Group",
    };
    const pendingEvents = [
      {
        id: "evt-other",
        member_id: "account-1",
        status: NotificationEventStatus.QUEUED,
        payload: { request_type: "OTHER", selected_days: [] },
      },
      {
        id: "evt-join",
        member_id: "account-1",
        status: NotificationEventStatus.QUEUED,
        payload: {
          request_type: "GROUP_CLASS_JOIN",
          selected_days: [{ group_class_id: "session-1" }],
        },
      },
    ];

    vi.spyOn(GroupClassService, "getJoinedCountsBySessionIds").mockResolvedValue(
      new Map([["session-1", { joined: 0, approved: 0 }]])
    );
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("ClassSession")) return { findOne: vi.fn().mockResolvedValue(session) } as any;
      if (name.includes("SalonMembership")) return { findOne: vi.fn().mockResolvedValue({ id: "membership-1" }) } as any;
      if (name.includes("Package")) return { findOne: vi.fn().mockResolvedValue({ id: "pkg-1", title: "Group Package" }) } as any;
      if (name.includes("Booking")) return { findOne: vi.fn().mockResolvedValue(null) } as any;
      if (name.includes("NotificationEvent")) return { find: vi.fn().mockResolvedValue(pendingEvents) } as any;
      return {} as any;
    });

    await expect(
      MemberGroupClassesController.join(
        {
          tenantId: "tenant-1",
          auth: { sub: "member-1", accountId: "account-1" },
          params: { id: "session-1" },
        } as any,
        createMockResponse() as any
      )
    ).rejects.toMatchObject({ code: "GROUP_CLASS_REQUEST_EXISTS", statusCode: 409 });
  });

  it("counts queued join requests against group class capacity", async () => {
    const session = {
      id: "session-1",
      tenant_id: "tenant-1",
      type: SessionType.GROUP,
      status: SessionStatus.SCHEDULED,
      starts_at: new Date("2026-05-12T10:00:00.000Z"),
      ends_at: new Date("2026-05-12T11:00:00.000Z"),
      notification_scope: GroupClassNotificationScope.SALON_MEMBERS,
      related_package_id: "pkg-1",
      capacity: 1,
      title: "Group",
    };

    const notificationFind = vi.fn().mockResolvedValue([
      {
        id: "evt-join-other",
        member_id: "other-member",
        status: NotificationEventStatus.QUEUED,
        payload: {
          request_type: "GROUP_CLASS_JOIN",
          selected_days: [{ group_class_id: "session-1" }],
        },
      },
    ]);

    vi.spyOn(GroupClassService, "getJoinedCountsBySessionIds").mockResolvedValue(
      new Map([["session-1", { joined: 0, approved: 0 }]])
    );
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("ClassSession")) return { findOne: vi.fn().mockResolvedValue(session) } as any;
      if (name.includes("SalonMembership")) return { findOne: vi.fn().mockResolvedValue({ id: "membership-1" }) } as any;
      if (name.includes("Package")) return { findOne: vi.fn().mockResolvedValue({ id: "pkg-1", title: "Group Package" }) } as any;
      if (name.includes("Booking")) return { findOne: vi.fn().mockResolvedValue(null) } as any;
      if (name.includes("NotificationEvent")) {
        return {
          find: notificationFind,
        } as any;
      }
      return {} as any;
    });

    await expect(
      MemberGroupClassesController.join(
        {
          tenantId: "tenant-1",
          auth: { sub: "member-1", accountId: "account-1" },
          params: { id: "session-1" },
        } as any,
        createMockResponse() as any
      )
    ).rejects.toMatchObject({ code: "GROUP_CLASS_FULL", statusCode: 409 });

    expect(notificationFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ member_id: expect.any(String) }),
      })
    );
  });

  it("cancels queued join requests stored with a JSON text payload when member leaves", async () => {
    const booking = {
      id: "booking-1",
      status: BookingStatus.PENDING,
      payment_status: BookingPaymentStatus.PENDING,
      meta: {},
    };
    const event = {
      id: "evt-join",
      status: NotificationEventStatus.QUEUED,
      payload: JSON.stringify({
        request_type: "GROUP_CLASS_JOIN",
        selected_days: [{ group_class_id: "session-1" }],
        package_id: "pkg-1",
      }),
    };
    const bookingRepo = {
      find: vi.fn().mockResolvedValue([booking]),
      save: vi.fn().mockResolvedValue([booking]),
    };
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([event]),
      save: vi.fn().mockResolvedValue([event]),
    };
    const attendanceRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      return {} as any;
    });

    const res = createMockResponse();

    await MemberGroupClassesController.leave(
      {
        tenantId: "tenant-1",
        auth: { sub: "member-1", accountId: "account-1" },
        params: { id: "session-1" },
      } as any,
      res as any
    );

    expect(event.status).toBe(NotificationEventStatus.PROCESSED);
    expect(event.payload).toEqual(
      expect.objectContaining({
        request_type: "GROUP_CLASS_JOIN",
        package_id: "pkg-1",
        decision: "CANCELED",
        status: "CANCELED",
      })
    );
    expect(booking.status).toBe(BookingStatus.CANCELED);
    expect(res.body.data.canceled_request_count).toBe(1);
  });
});
