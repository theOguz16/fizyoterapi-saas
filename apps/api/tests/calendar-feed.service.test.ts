import { describe, expect, it } from "vitest";
import { CalendarFeedService } from "../services/calendar-feed.service";
import { Availability } from "../entities/availability.entity";
import { Booking, BookingCheckinStatus, BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { User, UserRole } from "../entities/user.entity";

const from = new Date("2026-07-01T00:00:00.000Z");
const to = new Date("2026-07-29T00:00:00.000Z");

const users = [
  { id: "member-1", first_name: "Ayşe", last_name: "Üye", role: UserRole.MEMBER },
  { id: "member-2", first_name: "Can", last_name: "Üye", role: UserRole.MEMBER },
  { id: "trainer-1", first_name: "Deniz", last_name: "Uzman", role: UserRole.TRAINER },
] as User[];

function booking(input: Partial<Booking> & Pick<Booking, "id" | "member_id" | "starts_at" | "ends_at">): Booking {
  return {
    tenant_id: "tenant-1",
    trainer_id: "trainer-1",
    status: BookingStatus.APPROVED,
    payment_status: BookingPaymentStatus.APPROVED,
    checkin_status: BookingCheckinStatus.PENDING,
    credits_charged: 0,
    meta: { package_id: "package-1", package_title: "Klinik Pilates" },
    ...input,
  } as Booking;
}

function build(role: "ADMIN" | "TRAINER" | "MEMBER", bookings: Booking[], availabilities: Availability[] = []) {
  return CalendarFeedService.buildFeed({
    role,
    actorUserId: role === "MEMBER" ? "member-1" : role === "TRAINER" ? "trainer-1" : "admin-1",
    timezone: "Europe/Istanbul",
    from,
    to,
    businessHours: { timezone: "Europe/Istanbul", working_days: [1, 2, 3, 4, 5], start_time: "09:00", end_time: "18:00" },
    bookings,
    sessions: [],
    availabilities,
    pendingAvailabilitySlots: [],
    users,
    packages: [],
    scheduleChanges: new Map(),
  });
}

describe("CalendarFeedService", () => {
  it("keeps one booking identity, time and status identical in all three roles", () => {
    const sharedBooking = booking({
      id: "booking-1",
      member_id: "member-1",
      starts_at: new Date("2026-07-08T09:00:00.000Z"),
      ends_at: new Date("2026-07-08T10:00:00.000Z"),
    });

    const roleEvents = (["ADMIN", "TRAINER", "MEMBER"] as const).map((role) => build(role, [sharedBooking]).events[0]);
    expect(roleEvents.map(({ id, starts_at, ends_at, status }) => ({ id, starts_at, ends_at, status }))).toEqual([
      { id: "booking:booking-1", starts_at: "2026-07-08T09:00:00.000Z", ends_at: "2026-07-08T10:00:00.000Z", status: "APPROVED" },
      { id: "booking:booking-1", starts_at: "2026-07-08T09:00:00.000Z", ends_at: "2026-07-08T10:00:00.000Z", status: "APPROVED" },
      { id: "booking:booking-1", starts_at: "2026-07-08T09:00:00.000Z", ends_at: "2026-07-08T10:00:00.000Z", status: "APPROVED" },
    ]);
    expect(roleEvents[0].details.member_full_name).toBe("Ayşe Üye");
    expect(roleEvents[2].details.member_full_name).toBeNull();
  });

  it("enforces role visibility again while building the response", () => {
    const own = booking({ id: "booking-own", member_id: "member-1", starts_at: new Date("2026-07-08T09:00:00.000Z"), ends_at: new Date("2026-07-08T10:00:00.000Z") });
    const otherMember = booking({ id: "booking-other-member", member_id: "member-2", starts_at: new Date("2026-07-09T09:00:00.000Z"), ends_at: new Date("2026-07-09T10:00:00.000Z") });
    const otherTrainer = booking({ id: "booking-other-trainer", member_id: "member-1", trainer_id: "trainer-2", starts_at: new Date("2026-07-10T09:00:00.000Z"), ends_at: new Date("2026-07-10T10:00:00.000Z") });

    expect(build("MEMBER", [own, otherMember]).events.map((event) => event.entity_id)).toEqual(["booking-own"]);
    expect(build("TRAINER", [own, otherTrainer]).events.map((event) => event.entity_id)).toEqual(["booking-own"]);
    expect(build("ADMIN", [own, otherMember, otherTrainer]).events).toHaveLength(3);
  });

  it("projects weekly member availability on the backend and suppresses a booked occurrence", () => {
    const sharedBooking = booking({
      id: "booking-1",
      member_id: "member-1",
      starts_at: new Date("2026-07-08T09:00:00.000Z"),
      ends_at: new Date("2026-07-08T10:00:00.000Z"),
    });
    const template = {
      id: "availability-1",
      tenant_id: "tenant-1",
      member_id: "member-1",
      starts_at: new Date("2026-06-24T09:00:00.000Z"),
      ends_at: new Date("2026-06-24T10:00:00.000Z"),
      package_id: "package-1",
    } as Availability;

    const events = build("MEMBER", [sharedBooking], [template]).events;
    const availabilityEvents = events.filter((event) => event.source === "AVAILABILITY");
    expect(availabilityEvents).toHaveLength(3);
    expect(availabilityEvents.every((event) => event.recurrence.kind === "WEEKLY")).toBe(true);
    expect(availabilityEvents.map((event) => event.starts_at)).not.toContain("2026-07-08T09:00:00.000Z");
  });

  it("uses one pending schedule-change state without replacing the accepted booking time", () => {
    const sharedBooking = booking({
      id: "booking-change",
      member_id: "member-1",
      starts_at: new Date("2026-07-08T09:00:00.000Z"),
      ends_at: new Date("2026-07-08T10:00:00.000Z"),
    });
    const baseInput = {
      role: "MEMBER" as const,
      actorUserId: "member-1",
      timezone: "Europe/Istanbul",
      from,
      to,
      businessHours: null,
      bookings: [sharedBooking],
      sessions: [],
      availabilities: [],
      pendingAvailabilitySlots: [],
      users,
      packages: [],
      scheduleChanges: new Map([["booking-change", {
        request_id: "request-1",
        proposed_starts_at: "2026-07-09T11:00:00.000Z",
        proposed_ends_at: "2026-07-09T12:00:00.000Z",
      }]]),
    };

    const event = CalendarFeedService.buildFeed(baseInput).events[0];
    expect(event).toMatchObject({
      starts_at: "2026-07-08T09:00:00.000Z",
      ends_at: "2026-07-08T10:00:00.000Z",
      approval_status: "PENDING",
      presentation: { badge_label: "Saat Onayı Bekliyor" },
      details: {
        pending_schedule_change: {
          request_id: "request-1",
          proposed_starts_at: "2026-07-09T11:00:00.000Z",
          proposed_ends_at: "2026-07-09T12:00:00.000Z",
        },
      },
    });
  });

  it("preserves cancellation and computes real trainer conflicts centrally", () => {
    const events = build("ADMIN", [
      booking({ id: "booking-1", member_id: "member-1", starts_at: new Date("2026-07-08T09:00:00.000Z"), ends_at: new Date("2026-07-08T10:00:00.000Z") }),
      booking({ id: "booking-2", member_id: "member-2", starts_at: new Date("2026-07-08T09:30:00.000Z"), ends_at: new Date("2026-07-08T10:30:00.000Z") }),
      booking({ id: "booking-3", member_id: "member-1", starts_at: new Date("2026-07-09T09:00:00.000Z"), ends_at: new Date("2026-07-09T10:00:00.000Z"), status: BookingStatus.CANCELED }),
    ]).events;

    expect(events.find((event) => event.id === "booking:booking-1")?.conflict).toEqual({ has_conflict: true, event_ids: ["booking:booking-2"] });
    expect(events.find((event) => event.id === "booking:booking-2")?.conflict).toEqual({ has_conflict: true, event_ids: ["booking:booking-1"] });
    expect(events.find((event) => event.id === "booking:booking-3")).toMatchObject({ is_cancelled: true, status: "CANCELED", approval_status: "NONE" });
  });

  it("validates timezone and enforces the 26-week range budget", () => {
    const valid = CalendarFeedService.parseRange({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-12-30T00:00:00.000Z",
      timezone: "Europe/Istanbul",
    });
    expect(valid.timezone).toBe("Europe/Istanbul");
    expect(() => CalendarFeedService.parseRange({ from: from.toISOString(), to: "2027-07-01T00:00:00.000Z" })).toThrow(/26 hafta/);
    expect(() => CalendarFeedService.parseRange({ from: from.toISOString(), to: to.toISOString(), timezone: "Mars/Olympus" })).toThrow(/IANA timezone/);
  });
});
