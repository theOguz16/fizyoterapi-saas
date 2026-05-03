import { describe, expect, it } from "vitest";
import { buildMemberMomentum, formatMemberHomeDate, getCancellationState } from "@/lib/member-home";

describe("member home helpers", () => {
  it("formats member dates for Turkish locale and handles empty values", () => {
    expect(formatMemberHomeDate(null)).toBe("Belirtilmedi");
    expect(formatMemberHomeDate("2026-03-05T09:00:00.000Z")).toContain("05.03.2026");
  });

  it("marks booking cancellable when enough lead time remains", () => {
    const now = new Date("2026-03-05T09:00:00.000Z").getTime();
    expect(getCancellationState("2026-03-05T13:00:00.000Z", 3, now)).toEqual({
      label: "İptal edilebilir",
      canCancel: true,
    });
  });

  it("marks booking expired when cancellation window is closed", () => {
    const now = new Date("2026-03-05T09:00:00.000Z").getTime();
    expect(getCancellationState("2026-03-05T10:00:00.000Z", 3, now)).toEqual({
      label: "İptal süresi doldu",
      canCancel: false,
    });
  });

  it("builds bounded member momentum from attendance data", () => {
    expect(
      buildMemberMomentum({
        lesson_usage: {
          weekly_target: 4,
          attended_this_week: 5,
        },
        attendance_summary: {
          total: 18,
        },
      })
    ).toEqual({
      streak: 7,
      weeklyScore: 100,
      level: 4,
      petName: "Minik Koala",
      rewardLabel: "Parilti rozeti",
    });
  });
});
