import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { buildTrainerSummary, getRetentionReasons, isCompletedBooking, type TrainerBookingInsight } from "@/lib/admin-trainer-insights";

describe("admin trainer insight helpers", () => {
  it("counts completed lessons and skips cancelled bookings", () => {
    const now = Date.parse("2026-05-09T12:00:00.000Z");
    const bookings: TrainerBookingInsight[] = [
      {
        id: "b-1",
        status: "COMPLETED",
        starts_at: "2026-05-09T08:00:00.000Z",
        lesson_category_label: "Pilates",
      },
      {
        id: "b-2",
        status: "APPROVED",
        starts_at: "2026-05-09T10:00:00.000Z",
        session_title: "Reformer",
      },
      {
        id: "b-3",
        status: "CANCELLED",
        starts_at: "2026-05-09T07:00:00.000Z",
        package_title: "İptal Paket",
      },
      {
        id: "b-4",
        status: "APPROVED",
        starts_at: "2026-05-10T10:00:00.000Z",
        package_title: "Gelecek Ders",
      },
    ];

    expect(isCompletedBooking(bookings[1], now)).toBe(true);
    expect(isCompletedBooking(bookings[2], now)).toBe(false);

    expect(buildTrainerSummary(bookings, now)).toEqual({
      total: 3,
      completed: 2,
      uniqueLessons: ["Pilates", "Reformer"],
      recentLessons: [bookings[0], bookings[1]],
    });
  });

  it("collects retention reasons from nested and fallback fields", () => {
    expect(
      getRetentionReasons({
        breakdown: { reasons: ["10 gündür katılım yok"] },
        reason: "Paket bitişi yaklaşıyor",
        primary_reasom: "Ölçüm güncellenmedi",
      })
    ).toEqual(["10 gündür katılım yok", "Paket bitişi yaklaşıyor", "Ölçüm güncellenmedi"]);
  });

  it("builds trainer summaries quickly for large booking lists", () => {
    const bookings: TrainerBookingInsight[] = Array.from({ length: 1500 }, (_, index) => ({
      id: `booking-${index + 1}`,
      status: index % 9 === 0 ? "CANCELLED" : index % 5 === 0 ? "COMPLETED" : "APPROVED",
      starts_at: `2026-05-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
      lesson_category_label: index % 2 === 0 ? "Pilates" : "PT",
      session_title: `Ders ${index + 1}`,
    }));

    const startedAt = performance.now();
    const summary = buildTrainerSummary(bookings, Date.parse("2026-05-30T12:00:00.000Z"));
    const elapsedMs = performance.now() - startedAt;

    expect(summary.total).toBeGreaterThan(1000);
    expect(summary.completed).toBeGreaterThan(1000);
    expect([...summary.uniqueLessons].sort()).toEqual(["PT", "Pilates"]);
    expect(elapsedMs).toBeLessThan(30);
  });
});
