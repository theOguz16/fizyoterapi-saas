import { describe, expect, it } from "vitest";
import { deriveApplicationStatusState, isApplicationPaymentPending } from "@/lib/application-status";

describe("application status helpers", () => {
  it("detects payment pending from either explicit request or approved application", () => {
    expect(isApplicationPaymentPending({ status: "APPROVED", payment_status: "UNPAID" }, null)).toBe(true);
    expect(isApplicationPaymentPending({ status: "PENDING", payment_status: "UNPAID" }, { status: "PENDING" })).toBe(
      true
    );
    expect(isApplicationPaymentPending({ status: "APPROVED", payment_status: "VERIFIED" }, null)).toBe(false);
  });

  it("builds active membership status cards", () => {
    expect(
      deriveApplicationStatusState({
        activeMembership: { tenant_name: "Demo Klinik" },
        latestApplication: null,
        pendingPaymentRequest: null,
      })
    ).toEqual(
      expect.objectContaining({
        mode: "active-membership",
        title: "Salonun hazır",
      })
    );
  });

  it("builds pending and empty application states", () => {
    expect(
      deriveApplicationStatusState({
        activeMembership: null,
        latestApplication: { status: "APPROVED", payment_status: "UNPAID" },
        pendingPaymentRequest: null,
      })
    ).toEqual(
      expect.objectContaining({
        mode: "payment-pending",
        tone: "warning",
      })
    );

    expect(
      deriveApplicationStatusState({
        activeMembership: null,
        latestApplication: null,
        pendingPaymentRequest: null,
      })
    ).toEqual(
      expect.objectContaining({
        mode: "empty",
        title: "Başvuru görünmüyor",
      })
    );
  });
});
