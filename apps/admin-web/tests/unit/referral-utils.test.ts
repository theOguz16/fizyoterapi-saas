import { describe, expect, it } from "vitest";
import { buildReferralMetrics, referralStatusLabel } from "@/app/admin/referrals/referral-utils";

describe("referral utils", () => {
  it("maps referral statuses to readable Turkish labels", () => {
    expect(referralStatusLabel("INVITED")).toBe("Davet Edildi");
    expect(referralStatusLabel("CONVERTED")).toBe("Kayıt Tamamlandı");
    expect(referralStatusLabel("REWARDED")).toBe("Ödül Aktarıldı");
    expect(referralStatusLabel("CANCELED")).toBe("İptal");
  });

  it("builds referral dashboard metrics", () => {
    expect(
      buildReferralMetrics(
        [
          { status: "INVITED" },
          { status: "CONVERTED" },
          { status: "REWARDED" },
          { status: "REWARDED" },
        ] as any,
        [{ id: "r1" }, { id: "r2" }]
      )
    ).toEqual({
      total: 4,
      converted: 1,
      rewarded: 2,
      rewardMovements: 2,
    });
  });
});
