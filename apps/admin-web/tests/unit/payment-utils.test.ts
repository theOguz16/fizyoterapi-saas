import { describe, expect, it } from "vitest";
import { membershipQueueFilter, paymentFilterLabel } from "@/app/admin/payments/payment-utils";

describe("payment utils", () => {
  const pending = { status: "APPROVED", payment_status: "UNPAID" };
  const joined = { status: "APPROVED", payment_status: "VERIFIED" };
  const rejected = { status: "REJECTED", payment_status: "REJECTED" };

  it("filters membership rows by payment queue", () => {
    expect(membershipQueueFilter(pending, "REQUESTED")).toBe(true);
    expect(membershipQueueFilter(joined, "APPROVED")).toBe(true);
    expect(membershipQueueFilter(rejected, "REJECTED")).toBe(true);
    expect(membershipQueueFilter(pending, "APPROVED")).toBe(false);
  });

  it("returns readable labels for active payment filters", () => {
    expect(paymentFilterLabel("REQUESTED")).toBe("Bekleyen");
    expect(paymentFilterLabel("APPROVED")).toBe("Onaylanan");
    expect(paymentFilterLabel("REJECTED")).toBe("Reddedilen");
  });
});
