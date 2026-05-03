import { describe, expect, it } from "vitest";
import { attendanceResultLabel, bookingStatusLabel, paymentStatusLabel, riskLabel } from "@/lib/presentation";

describe("presentation labels", () => {
  it("maps booking statuses to Turkish labels", () => {
    expect(bookingStatusLabel("PENDING")).toBe("Onay Bekliyor");
    expect(bookingStatusLabel("APPROVED")).toBe("Onaylandı");
    expect(bookingStatusLabel("X")).toBe("X");
  });

  it("maps payment statuses to Turkish labels", () => {
    expect(paymentStatusLabel("UNPAID")).toBe("Ödeme Bekleniyor");
    expect(paymentStatusLabel("VERIFIED")).toBe("Ödeme Onaylandı");
    expect(paymentStatusLabel(undefined)).toBe("Belirtilmedi");
  });

  it("maps attendance and risk states to readable copy", () => {
    expect(attendanceResultLabel("CREDIT_DEDUCTED")).toBe("Derse katıldı");
    expect(riskLabel("HIGH")).toBe("Çok Riskli");
    expect(riskLabel(null)).toBe("Belirtilmedi");
  });
});
