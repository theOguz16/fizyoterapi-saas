import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
}));

describe("schedule change request storage", () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it("creates, filters and applies approved schedule changes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1777000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456);

    const {
      approveScheduleChangeRequest,
      applyApprovedScheduleChanges,
      createScheduleChangeRequest,
      findPendingScheduleChangeForBooking,
      listPendingScheduleChangeRequestsForMember,
    } = await import("@/lib/schedule-change-requests");

    const createdRows = await createScheduleChangeRequest({
      bookingId: "booking-1",
      memberId: "member-1",
      memberName: "Demo Member",
      trainerId: "trainer-1",
      trainerName: "Demo Trainer",
      tenantName: "Clinerva",
      sessionTitle: "Reformer",
      packageTitle: "8 Ders",
      currentStartsAt: "2026-04-23T09:00:00.000Z",
      currentEndsAt: "2026-04-23T10:00:00.000Z",
      proposedStartsAt: "2026-04-24T09:00:00.000Z",
      proposedEndsAt: "2026-04-24T10:00:00.000Z",
      note: "Uygunluk değişti",
    });

    expect(createdRows[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining("schedule-change-"),
        bookingId: "booking-1",
        status: "PENDING",
      })
    );
    await expect(findPendingScheduleChangeForBooking("booking-1")).resolves.toEqual(
      expect.objectContaining({ bookingId: "booking-1", status: "PENDING" })
    );
    await expect(listPendingScheduleChangeRequestsForMember("member-1")).resolves.toHaveLength(1);

    await approveScheduleChangeRequest(createdRows[0].id);

    const applied = await applyApprovedScheduleChanges([
      {
        id: "booking-1",
        starts_at: "2026-04-23T09:00:00.000Z",
        ends_at: "2026-04-23T10:00:00.000Z",
        status: "APPROVED",
      },
    ]);

    expect(applied).toEqual([
      {
        id: "booking-1",
        starts_at: "2026-04-24T09:00:00.000Z",
        ends_at: "2026-04-24T10:00:00.000Z",
        status: "RESCHEDULED",
      },
    ]);
  });

  it("returns empty arrays when storage is missing or member id is absent", async () => {
    const { listPendingScheduleChangeRequestsForMember, listScheduleChangeRequests } = await import("@/lib/schedule-change-requests");

    await expect(listScheduleChangeRequests()).resolves.toEqual([]);
    await expect(listPendingScheduleChangeRequestsForMember(null)).resolves.toEqual([]);
  });
});
