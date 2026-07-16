import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = { OS: "ios" };
const purchases = {
  configure: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
};

const envKeys = [
  "EXPO_PUBLIC_REVENUECAT_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

async function loadRevenueCat() {
  return import("@/lib/revenuecat");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("react-native");
  vi.doUnmock("react-native-purchases");
  platform.OS = "ios";
  for (const key of envKeys) delete process.env[key];
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "ios-key";
  purchases.configure.mockResolvedValue(undefined);
  purchases.getOfferings.mockResolvedValue({
    current: {
      monthly: { identifier: "monthly" },
      annual: { identifier: "annual" },
    },
  });
  purchases.purchasePackage.mockResolvedValue({ customerInfo: {} });
  purchases.restorePurchases.mockResolvedValue({});
  vi.doMock("react-native", () => ({ Platform: platform }));
  vi.doMock("react-native-purchases", () => ({ default: purchases }));
});

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("RevenueCat user-facing errors", () => {
  it("does not expose missing key details", async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    const { configureRevenueCat } = await loadRevenueCat();

    await expect(configureRevenueCat("clinic-1")).rejects.toThrow(
      "Satın alma özelliği şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."
    );
  });

  it("normalizes configure SDK rejections", async () => {
    purchases.configure.mockRejectedValue(new Error("Invalid RevenueCat API key"));
    const { configureRevenueCat } = await loadRevenueCat();

    await expect(configureRevenueCat("clinic-1")).rejects.toThrow(
      "Satın alma özelliği şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."
    );
  });

  it("normalizes offering SDK rejections and missing current offerings", async () => {
    const { getRevenueCatPlanPackages } = await loadRevenueCat();
    purchases.getOfferings.mockRejectedValueOnce(new Error("RevenueCat offering request failed"));
    await expect(getRevenueCatPlanPackages("clinic-1")).rejects.toThrow(
      "Abonelik seçenekleri şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin."
    );

    purchases.getOfferings.mockResolvedValueOnce({ current: null });
    await expect(getRevenueCatPlanPackages("clinic-1")).rejects.toThrow(
      "Abonelik seçenekleri şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin."
    );
  });

  it("reports a missing selected package without technical details", async () => {
    purchases.getOfferings.mockResolvedValue({ current: { availablePackages: [] } });
    const { purchaseRevenueCatPackage } = await loadRevenueCat();

    await expect(purchaseRevenueCatPackage("clinic-1", "monthly")).rejects.toThrow(
      "Satın alınabilir abonelik paketi bulunamadı. Lütfen daha sonra tekrar deneyin."
    );
  });

  it("normalizes purchase SDK rejections", async () => {
    purchases.purchasePackage.mockRejectedValue(new Error("STORE_PROBLEM_ERROR"));
    const { purchaseRevenueCatPackage } = await loadRevenueCat();

    await expect(purchaseRevenueCatPackage("clinic-1", "monthly")).rejects.toThrow(
      "Satın alma tamamlanamadı. Lütfen tekrar deneyin."
    );
  });

  it("reports user-cancelled purchases separately", async () => {
    purchases.purchasePackage.mockRejectedValue({ userCancelled: true, message: "Purchase was cancelled" });
    const { purchaseRevenueCatPackage } = await loadRevenueCat();

    await expect(purchaseRevenueCatPackage("clinic-1", "monthly")).rejects.toThrow(
      "Satın alma işlemi iptal edildi."
    );
  });

  it("normalizes restore SDK rejections", async () => {
    purchases.restorePurchases.mockRejectedValue(new Error("Underlying store error"));
    const { restoreRevenueCatPurchases } = await loadRevenueCat();

    await expect(restoreRevenueCatPurchases("clinic-1")).rejects.toThrow(
      "Satın alma kayıtları geri yüklenemedi. Lütfen tekrar deneyin."
    );
  });

  it("selects the Android key on Android", async () => {
    platform.OS = "android";
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = "android-key";
    const { configureRevenueCat } = await loadRevenueCat();

    await configureRevenueCat("clinic-android");

    expect(purchases.configure).toHaveBeenCalledWith({
      apiKey: "android-key",
      appUserID: "clinic-android",
    });
  });

  it("does not expose missing native module details", async () => {
    vi.doMock("react-native-purchases", () => {
      throw new Error("Native module cannot be found");
    });
    const { configureRevenueCat } = await loadRevenueCat();

    await expect(configureRevenueCat("clinic-1")).rejects.toThrow(
      "Satın alma özelliği şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."
    );
  });
});
