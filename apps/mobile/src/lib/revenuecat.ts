import { Platform } from "react-native";
import type { BillingCycle } from "./subscription-pricing";

type RevenueCatPackage = {
  identifier?: string;
  product?: {
    identifier?: string;
    title?: string;
    description?: string;
    priceString?: string;
  };
  offeringIdentifier?: string;
  packageType?: string;
};

type RevenueCatOffering = {
  identifier?: string;
  serverDescription?: string;
  current?: unknown;
  availablePackages?: RevenueCatPackage[];
  monthly?: RevenueCatPackage | null;
  annual?: RevenueCatPackage | null;
};

type RevenueCatOfferings = {
  current?: RevenueCatOffering | null;
  all?: Record<string, RevenueCatOffering>;
};

type PurchasesClient = {
  configure(input: { apiKey: string; appUserID: string }): Promise<unknown> | unknown;
  getOfferings(): Promise<RevenueCatOfferings>;
  purchasePackage(pkg: RevenueCatPackage): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
};

type RevenueCatCustomerInfo = {
  entitlements?: {
    active?: Record<string, unknown>;
  };
};

const PURCHASES_UNAVAILABLE_MESSAGE =
  "Satın alma özelliği şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.";
const PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE =
  "Abonelik seçenekleri şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.";
const PURCHASE_FAILED_MESSAGE =
  "Satın alma tamamlanamadı. Lütfen tekrar deneyin.";
const PURCHASE_CANCELLED_MESSAGE =
  "Satın alma işlemi iptal edildi.";
const RESTORE_FAILED_MESSAGE =
  "Satın alma kayıtları geri yüklenemedi. Lütfen tekrar deneyin.";
const RESTORE_NOT_FOUND_MESSAGE =
  "Bu mağaza hesabında geri yüklenecek aktif abonelik bulunamadı.";

function hasActiveEntitlement(value: unknown) {
  const customerInfo =
    value && typeof value === "object" && "customerInfo" in value
      ? (value as { customerInfo?: RevenueCatCustomerInfo }).customerInfo
      : (value as RevenueCatCustomerInfo | null);
  return Object.keys(customerInfo?.entitlements?.active || {}).length > 0;
}

function isUserCancelledPurchase(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const source = error as { userCancelled?: unknown; code?: unknown };
  if (source.userCancelled === true) return true;
  if (source.code === 1 || source.code === "1") return true;
  const code = typeof source.code === "string" ? source.code.toUpperCase() : "";
  return code.includes("PURCHASE_CANCELLED") || code.includes("USER_CANCELLED");
}

function getRevenueCatApiKey() {
  const fallbackKey = (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "").trim();
  if (Platform.OS === "ios") {
    return (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || fallbackKey).trim();
  }
  if (Platform.OS === "android") {
    return (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || fallbackKey).trim();
  }
  return fallbackKey;
}

async function getPurchasesModule() {
  try {
    const purchasesModule = await import("react-native-purchases");
    return (purchasesModule.default || purchasesModule) as unknown as PurchasesClient;
  } catch {
    throw new Error(PURCHASES_UNAVAILABLE_MESSAGE);
  }
}

let configuredAppUserId: string | null = null;

function isExplicitE2EMode() {
  return process.env.EXPO_PUBLIC_E2E_MODE === "1";
}

async function emitE2ESubscriptionEvent(
  appUserId: string,
  action: "PURCHASE" | "CANCEL" | "RESTORE",
  billingCycle?: BillingCycle
) {
  const { runE2ESubscriptionEventApi } = await import("./api/subscription");
  return runE2ESubscriptionEventApi(appUserId, action, billingCycle);
}

function buildE2EOfferings(): RevenueCatOfferings {
  const monthly: RevenueCatPackage = {
    identifier: "$rc_monthly",
    packageType: "MONTHLY",
    product: { identifier: "fizyoflow_plus_monthly", title: "FizyoFlow Aylık", priceString: "₺1.499,99" },
  };
  const annual: RevenueCatPackage = {
    identifier: "$rc_annual",
    packageType: "ANNUAL",
    product: { identifier: "fizyoflow_plus_yearly", title: "FizyoFlow Yıllık", priceString: "₺14.999,99" },
  };
  return { current: { identifier: "e2e", monthly, annual, availablePackages: [monthly, annual] } };
}

export async function configureRevenueCat(appUserId: string, useE2EAdapter = false) {
  if (useE2EAdapter || isExplicitE2EMode()) {
    configuredAppUserId = appUserId;
    return;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error(PURCHASES_UNAVAILABLE_MESSAGE);
  }

  const Purchases = await getPurchasesModule();

  if (configuredAppUserId === appUserId) return;

  try {
    await Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });
  } catch {
    throw new Error(PURCHASES_UNAVAILABLE_MESSAGE);
  }
  configuredAppUserId = appUserId;
}

export async function getRevenueCatOfferings(appUserId: string, useE2EAdapter = false) {
  if (useE2EAdapter || isExplicitE2EMode()) return buildE2EOfferings();
  await configureRevenueCat(appUserId);
  const Purchases = await getPurchasesModule();
  try {
    return (await Purchases.getOfferings()) as RevenueCatOfferings;
  } catch {
    throw new Error(PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE);
  }
}

export async function getRevenueCatCurrentPackage(appUserId: string) {
  const offerings = await getRevenueCatOfferings(appUserId);
  const current = offerings.current;
  if (!current) {
    throw new Error(PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE);
  }

  return current.monthly || current.annual || current.availablePackages?.[0] || null;
}

export async function getRevenueCatPlanPackages(appUserId: string, useE2EAdapter = false) {
  const offerings = await getRevenueCatOfferings(appUserId, useE2EAdapter);
  const current = offerings.current;
  if (!current) {
    throw new Error(PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE);
  }

  const monthly =
    current.monthly ||
    current.availablePackages?.find((pkg) => pkg.packageType === "MONTHLY" || pkg.identifier === "monthly" || pkg.identifier === "$rc_monthly") ||
    null;
  const yearly =
    current.annual ||
    current.availablePackages?.find((pkg) => pkg.packageType === "ANNUAL" || pkg.identifier === "annual" || pkg.identifier === "$rc_annual") ||
    null;

  return { monthly, yearly };
}

export async function getRevenueCatPackageForPlan(appUserId: string, billingCycle: BillingCycle, useE2EAdapter = false) {
  const offerings = await getRevenueCatOfferings(appUserId, useE2EAdapter);
  const current = offerings.current;
  if (!current) {
    throw new Error(PURCHASE_OPTIONS_UNAVAILABLE_MESSAGE);
  }

  if (billingCycle === "yearly") {
    return current.annual || current.availablePackages?.find((pkg) => pkg.packageType === "ANNUAL" || pkg.identifier === "annual") || null;
  }

  return current.monthly || current.availablePackages?.find((pkg) => pkg.packageType === "MONTHLY" || pkg.identifier === "monthly") || null;
}

export async function purchaseRevenueCatPackage(appUserId: string, billingCycle: BillingCycle, useE2EAdapter = false) {
  if (useE2EAdapter || isExplicitE2EMode()) {
    await emitE2ESubscriptionEvent(appUserId, "PURCHASE", billingCycle);
    return { customerInfo: { entitlements: { active: { fizyoflow_plus: {} } } } };
  }
  const Purchases = await getPurchasesModule();
  const pkg = await getRevenueCatPackageForPlan(appUserId, billingCycle, useE2EAdapter);
  if (!pkg) {
    throw new Error("Satın alınabilir abonelik paketi bulunamadı. Lütfen daha sonra tekrar deneyin.");
  }

  try {
    return await Purchases.purchasePackage(pkg);
  } catch (error) {
    if (isUserCancelledPurchase(error)) {
      throw new Error(PURCHASE_CANCELLED_MESSAGE);
    }
    throw new Error(PURCHASE_FAILED_MESSAGE);
  }
}

export async function purchaseRevenueCatCurrentPackage(appUserId: string) {
  return purchaseRevenueCatPackage(appUserId, "monthly");
}

export async function restoreRevenueCatPurchases(appUserId: string, useE2EAdapter = false) {
  if (useE2EAdapter || isExplicitE2EMode()) {
    await emitE2ESubscriptionEvent(appUserId, "RESTORE");
    return { entitlements: { active: { fizyoflow_plus: {} } } };
  }
  await configureRevenueCat(appUserId);
  const Purchases = await getPurchasesModule();
  try {
    const customerInfo = await Purchases.restorePurchases();
    if (!hasActiveEntitlement(customerInfo)) {
      throw new Error(RESTORE_NOT_FOUND_MESSAGE);
    }
    return customerInfo;
  } catch (error) {
    if (error instanceof Error && error.message === RESTORE_NOT_FOUND_MESSAGE) throw error;
    throw new Error(RESTORE_FAILED_MESSAGE);
  }
}

export async function manageRevenueCatSubscription(appUserId: string, useE2EAdapter = false) {
  if (useE2EAdapter || isExplicitE2EMode()) {
    await emitE2ESubscriptionEvent(appUserId, "CANCEL");
    return { openedStore: false, cancellationRecorded: true };
  }

  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  const { Linking } = await import("react-native");
  await Linking.openURL(url);
  return { openedStore: true, cancellationRecorded: false };
}
