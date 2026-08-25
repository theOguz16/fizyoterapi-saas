import { describe, expect, it } from "vitest";
import {
  buildAdminHomePriorities,
  buildMemberHomePriorities,
  buildTrainerHomePriorities,
} from "@/lib/home-priority";

describe("home priority builders", () => {
  it("puts incomplete admin setup first and limits the result to three actions", () => {
    const priorities = buildAdminHomePriorities({
      setup: {
        isComplete: false,
        completed: 2,
        total: 4,
        nextStep: {
          key: "package",
          title: "İlk paketini oluştur",
          description: "Paket ekle",
          complete: false,
          route: "/(admin)/packages",
          icon: "package",
        },
      },
      pendingApprovals: 4,
      todaysBookings: 8,
      atRiskMembers: 2,
    });

    expect(priorities).toHaveLength(3);
    expect(priorities.map((item) => item.key)).toEqual(["setup", "approvals", "today"]);
    expect(priorities[0]).toMatchObject({
      value: "2/4",
      route: "/(admin)/packages",
      testID: "admin-home-priority-setup",
    });
  });

  it("returns a calm admin success state instead of zero-valued warnings", () => {
    const priorities = buildAdminHomePriorities({
      setup: { isComplete: true, completed: 4, total: 4, nextStep: null },
      pendingApprovals: 0,
      todaysBookings: 0,
      atRiskMembers: 0,
    });

    expect(priorities).toEqual([
      expect.objectContaining({
        key: "success",
        tone: "success",
        route: null,
      }),
    ]);
  });

  it("prioritizes an imminent trainer check-in over requests and later sessions", () => {
    const now = new Date("2026-07-30T09:00:00.000Z").getTime();
    const priorities = buildTrainerHomePriorities({
      now,
      pendingRequestCount: 2,
      bookings: [
        {
          id: "later",
          member_id: "member-2",
          member_full_name: "Ece Kara",
          session_id: "session-2",
          starts_at: "2026-07-30T13:00:00.000Z",
          status: "APPROVED",
        },
        {
          id: "soon",
          member_id: "member-1",
          member_full_name: "Ada Yılmaz",
          session_id: "session-1",
          starts_at: "2026-07-30T09:30:00.000Z",
          status: "APPROVED",
        },
      ],
    });

    expect(priorities.map((item) => item.key)).toEqual(["imminent", "requests", "checkin"]);
    expect(priorities[0]).toMatchObject({
      route: "/(trainer)/checkin",
      params: { sessionId: "session-1" },
    });
  });

  it("ignores closed trainer bookings and gives an empty-day action", () => {
    const priorities = buildTrainerHomePriorities({
      bookings: [{ id: "closed", session_id: "session-1", status: "COMPLETED" }],
      pendingRequestCount: 0,
    });

    expect(priorities).toEqual([
      expect.objectContaining({
        key: "empty",
        route: "/(trainer)/calendar",
      }),
    ]);
  });

  it("orders member approval, application and booking ahead of lower priorities", () => {
    const priorities = buildMemberHomePriorities({
      pendingScheduleRequestCount: 1,
      hasPendingApplication: true,
      nextBooking: {
        id: "booking-1",
        starts_at: "2026-07-31T09:00:00.000Z",
        session_title: "Reformer",
      },
      remainingCredits: 1,
      groupClassCount: 5,
    });

    expect(priorities).toHaveLength(3);
    expect(priorities.map((item) => item.key)).toEqual([
      "schedule-request",
      "application",
      "next-booking",
    ]);
    expect(priorities[2]).toMatchObject({
      route: "/(member)/booking/[id]",
      params: { id: "booking-1" },
    });
  });

  it("shows both zero-credit recovery and no-booking planning without zero-value noise", () => {
    const priorities = buildMemberHomePriorities({
      remainingCredits: 0,
      groupClassCount: 0,
      nextBooking: null,
    });

    expect(priorities.map((item) => item.key)).toEqual(["low-credits", "no-booking"]);
    expect(priorities[0]).toMatchObject({
      value: 0,
      tone: "danger",
      route: "/(member)/package",
    });
    expect(priorities.some((item) => item.key === "group-class")).toBe(false);
  });
});
