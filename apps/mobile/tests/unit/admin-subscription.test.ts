import { describe, expect, it } from "vitest";
import { buildSubscriptionHeadline, formatSubscriptionStatus } from "@/lib/admin-subscription";
import { SUBSCRIPTION_VALUE_PROOFS } from "@/lib/subscription-pricing";

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
        can_start_trial: true,
        trial_days_remaining: 0,
      })
    ).toBe("21 günlük denemeyi başlat, salonunu ekip ve üye yönetimiyle birlikte canlı kullanıma aç.");
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

  it("covers the operational value shown before pricing without duplicate items", () => {
    expect(SUBSCRIPTION_VALUE_PROOFS.map((item) => item.key)).toEqual([
      "packages",
      "calendar",
      "team",
      "qr",
      "clients",
      "reports",
    ]);
    expect(new Set(SUBSCRIPTION_VALUE_PROOFS.map((item) => item.key)).size).toBe(SUBSCRIPTION_VALUE_PROOFS.length);
    expect(SUBSCRIPTION_VALUE_PROOFS.every((item) => item.title.length > 0 && item.description.length > 0)).toBe(true);
  });

  it("explains billing failures and cancelled renewal without revoking the current period", () => {
    expect(
      buildSubscriptionHeadline({
        review_status: "PUBLISHED",
        subscription_status: "ACTIVE",
        can_start_trial: false,
        trial_days_remaining: 0,
        has_billing_issue: true,
        will_renew: true,
      })
    ).toContain("Ödeme yöntemin doğrulanamadı");
    expect(
      buildSubscriptionHeadline({
        review_status: "PUBLISHED",
        subscription_status: "ACTIVE",
        can_start_trial: false,
        trial_days_remaining: 0,
        has_billing_issue: false,
        will_renew: false,
      })
    ).toContain("Otomatik yenileme kapalı");
  });
});
