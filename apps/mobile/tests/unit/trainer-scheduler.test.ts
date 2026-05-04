import { describe, expect, it } from "vitest";
import {
  findSlotByKey,
  groupAssignableRequestsByDay,
  isSlotAllowed,
  rebuildRequestFromCancelledBooking,
  toSlotKey,
} from "../../src/lib/trainer-scheduler";

describe("trainer scheduler helpers", () => {
  it("groups assignable requests by day and resolves slot keys", () => {
    const requests = [
      {
        id: "req-1",
        assignable_slots: [
          { starts_at: "2026-04-23T09:00:00.000Z", ends_at: "2026-04-23T10:00:00.000Z" },
          { starts_at: "2026-04-24T11:00:00.000Z", ends_at: "2026-04-24T12:00:00.000Z" },
        ],
      },
      {
        id: "req-2",
        assignable_slots: [{ starts_at: "2026-04-23T13:00:00.000Z", ends_at: "2026-04-23T14:00:00.000Z" }],
      },
    ];

    const grouped = groupAssignableRequestsByDay(requests);
    expect(grouped.get("2026-04-23")).toHaveLength(2);
    expect(grouped.get("2026-04-24")).toHaveLength(1);

    const slotKey = toSlotKey("2026-04-23T09:00:00.000Z");
    expect(findSlotByKey(slotKey, requests[0].assignable_slots)).toEqual({
      starts_at: "2026-04-23T09:00:00.000Z",
      ends_at: "2026-04-23T10:00:00.000Z",
    });
    expect(isSlotAllowed(slotKey, requests[0].assignable_slots)).toBe(true);
    expect(isSlotAllowed("2026-04-23-20:00", requests[0].assignable_slots)).toBe(false);
  });

  it("rebuilds a scheduling request from a canceled booking safely", () => {
    expect(
      rebuildRequestFromCancelledBooking({
        id: "booking-9",
        member_id: "member-1",
        member_full_name: "Demo Member",
        package_title: "8 Ders",
        assignable_slots: null,
        starts_at: "2026-04-23T09:00:00.000Z",
      })
    ).toEqual({
      id: "rebuild-booking-9",
      member_id: "member-1",
      member_full_name: "Demo Member",
      package_title: "8 Ders",
      assignable_slots: [],
      note: "İptal sonrası tekrar planlanabilir",
    });
  });
});
