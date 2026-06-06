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

function getPurchasesModule() {
  try {
    return require("react-native-purchases").default || require("react-native-purchases");
  } catch {
    throw new Error("RevenueCat native modulu bulunamadi. 'pnpm install' ve development build gerekli.");
  }
}

let configuredAppUserId: string | null = null;

export async function configureRevenueCat(appUserId: string) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error("RevenueCat API key tanimli degil. EXPO_PUBLIC_REVENUECAT_API_KEY veya platform keyleri gerekli.");
  }

  const Purchases = getPurchasesModule();

  if (configuredAppUserId === appUserId) return;

  await Purchases.configure({
    apiKey,
    appUserID: appUserId,
  });
  configuredAppUserId = appUserId;
}

export async function getRevenueCatOfferings(appUserId: string) {
  await configureRevenueCat(appUserId);
  const Purchases = getPurchasesModule();
  return (await Purchases.getOfferings()) as RevenueCatOfferings;
}

export async function getRevenueCatCurrentPackage(appUserId: string) {
  const offerings = await getRevenueCatOfferings(appUserId);
  const current = offerings.current;
  if (!current) {
    throw new Error("RevenueCat current offering bulunamadi.");
  }

  return current.monthly || current.annual || current.availablePackages?.[0] || null;
}

export async function getRevenueCatPackageForPlan(appUserId: string, billingCycle: BillingCycle) {
  const offerings = await getRevenueCatOfferings(appUserId);
  const current = offerings.current;
  if (!current) {
    throw new Error("RevenueCat current offering bulunamadi.");
  }

  if (billingCycle === "yearly") {
    return current.annual || current.availablePackages?.find((pkg) => pkg.packageType === "ANNUAL" || pkg.identifier === "annual") || null;
  }

  return current.monthly || current.availablePackages?.find((pkg) => pkg.packageType === "MONTHLY" || pkg.identifier === "monthly") || null;
}

export async function purchaseRevenueCatPackage(appUserId: string, billingCycle: BillingCycle) {
  const Purchases = getPurchasesModule();
  const pkg = await getRevenueCatPackageForPlan(appUserId, billingCycle);
  if (!pkg) {
    throw new Error("Satinalinabilir paket bulunamadi. RevenueCat offering ayarlarini kontrol edin.");
  }

  return Purchases.purchasePackage(pkg);
}

export async function purchaseRevenueCatCurrentPackage(appUserId: string) {
  return purchaseRevenueCatPackage(appUserId, "monthly");
}

export async function restoreRevenueCatPurchases(appUserId: string) {
  await configureRevenueCat(appUserId);
  const Purchases = getPurchasesModule();
  return Purchases.restorePurchases();
}
