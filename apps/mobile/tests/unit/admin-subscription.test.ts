import { describe, expect, it } from "vitest";
import { buildSubscriptionHeadline, formatSubscriptionStatus } from "@/lib/admin-subscription";

describe("admin subscription helpers", () => {
  it("formats known subscription states with publish-ready Turkish labels", () => {
    expect(formatSubscriptionStatus("TRIAL")).toBe("Deneme aktif");
    expect(formatSubscriptionStatus("ACTIVE")).toBe("Plan aktif");
    expect(formatSubscriptionStatus("READ_ONLY")).toBe("Erişim kısıtlı");
    expect(formatSubscriptionStatus("INACTIVE")).toBe("Plan başlamadı");
  });

  it("builds the right headline for review, trial and purchase states", () => {
    expect(buildSubscriptionHeadline()).toBe("Salonunu profesyonel mobil yönetim akışına taşımak için planını buradan başlat.");
    expect(
      buildSubscriptionHeadline({
        review_status: "PENDING",
        subscription_status: "INACTIVE",
        can_start_trial: false,
        trial_days_remaining: 0,
      })
    ).toBe("Salon incelemesi tamamlandığında deneme ve satın alma adımı burada açılacak.");
    expect(
      buildSubscriptionHeadline({
        review_status: "PUBLISHED",
        subscription_status: "TRIAL",
        can_start_trial: false,
        trial_days_remaining: 3,
      })
    ).toBe("FizyoFlow Pro denemen aktif. Kalan süre: 3 gün.");
    expect(
      buildSubscriptionHeadline({
        review_status: "PUBLISHED",
        subscription_status: "READ_ONLY",
        can_start_trial: false,
        trial_days_remaining: 0,
      })
    ).toBe("Deneme süren bitti. Satın alma ile salon akışlarını tekrar tam erişime açabilirsin.");
  });
});
