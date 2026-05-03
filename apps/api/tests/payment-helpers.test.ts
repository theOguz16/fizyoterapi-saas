import { describe, expect, it } from "vitest";
import { BookingPaymentStatus } from "../entities/booking.entity";
import { normalizePaymentNote, resolveBookingPaymentStatus } from "../controllers/admin/payment-helpers";

describe("payment helpers", () => {
  it("resolves payment status filters safely", () => {
    expect(resolveBookingPaymentStatus("requested")).toBe(BookingPaymentStatus.REQUESTED);
    expect(resolveBookingPaymentStatus("APPROVED")).toBe(BookingPaymentStatus.APPROVED);
    expect(resolveBookingPaymentStatus("unknown")).toBe(BookingPaymentStatus.REQUESTED);
    expect(resolveBookingPaymentStatus(undefined)).toBe(BookingPaymentStatus.REQUESTED);
  });

  it("normalizes optional payment notes", () => {
    expect(normalizePaymentNote("  Not eklendi  ")).toBe("Not eklendi");
    expect(normalizePaymentNote("")).toBeUndefined();
    expect(normalizePaymentNote(undefined, "mevcut")).toBe("mevcut");
    expect(normalizePaymentNote("x".repeat(600))?.length).toBe(500);
  });
});
