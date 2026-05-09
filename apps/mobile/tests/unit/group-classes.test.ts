import { describe, expect, it } from "vitest";
import {
  filterGroupClassSlotsForSelection,
  formatGroupClassPrice,
  getGroupClassAudienceLabel,
  getGroupClassCapacityLabel,
  getGroupClassScheduleLabel,
  isGroupClassBookingFlow,
} from "@/lib/group-classes";

describe("group classes helpers", () => {
  it("detects group class booking flow from lesson mode or drop-in flag", () => {
    expect(isGroupClassBookingFlow({ lessonMode: "GROUP", allowDropInBooking: false })).toBe(true);
    expect(isGroupClassBookingFlow({ lessonMode: "SINGLE", allowDropInBooking: true })).toBe(true);
    expect(isGroupClassBookingFlow({ lessonMode: "SINGLE", allowDropInBooking: false })).toBe(false);
  });

  it("filters slots down to the selected group lesson", () => {
    const rows = [
      { id: "1", lesson_name: "Pilates", is_group_class: true },
      { id: "2", lesson_name: "Yoga", is_group_class: true },
      { id: "3", lesson_name: "Pilates", is_group_class: true },
    ];

    expect(
      filterGroupClassSlotsForSelection(rows, {
        lessonMode: "GROUP",
        allowDropInBooking: true,
        selectedSubLesson: "Pilates",
      }).map((row: any) => row.id)
    ).toEqual(["1", "3"]);
  });

  it("does not include non-group slots when filtering group lessons", () => {
    const rows = [
      { id: "1", lesson_name: "Pilates", is_group_class: true },
      { id: "2", lesson_name: "Pilates", is_group_class: false },
      { id: "3", lesson_name: "Yoga", is_group_class: true },
    ];

    expect(
      filterGroupClassSlotsForSelection(rows, {
        lessonMode: "GROUP",
        allowDropInBooking: true,
        selectedSubLesson: "Pilates",
      }).map((row: any) => row.id)
    ).toEqual(["1"]);
  });

  it("builds display labels for scheduling, audience, capacity and price", () => {
    expect(getGroupClassScheduleLabel({ recurrence_label: "Her Salı, Perşembe" })).toBe("Her Salı, Perşembe");
    expect(getGroupClassAudienceLabel("INVITED_MEMBERS")).toBe("Sadece davetliler");
    expect(getGroupClassCapacityLabel({ joined_count: 4, capacity: 12 })).toBe("4/12 katılımcı");
    expect(formatGroupClassPrice(1800)).toBe("1.800 TL");
  });
});
