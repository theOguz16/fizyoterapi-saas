// Mobile API public domain endpointleri.
import { httpRequest } from "../http-client";
import type { ClinicIntake, ClinicIntakeResult, ClinicRecommendation, DiscoveryProfile, DiscoveryProfileResult, PackageOption, PlanRecommendation, PurchaseDaySelection, SalonDiscoverySummary, TrainerOption } from "./types";

export async function createDiscoveryProfileApi(payload: DiscoveryProfile) {
  return httpRequest<DiscoveryProfileResult>("/public/discovery-profile", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getClinicRecommendationsApi(payload: DiscoveryProfile) {
  return httpRequest<{ recommendations: ClinicRecommendation[] }>("/public/clinic-recommendations", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getPlanRecommendationApi(payload: DiscoveryProfile) {
  return httpRequest<PlanRecommendation>("/public/plan-recommendation", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function createClinicIntakeApi(payload: ClinicIntake) {
  return httpRequest<ClinicIntakeResult>("/public/clinic-intake", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function invitePreviewApi(token: string) {
  return httpRequest<any>(`/public/invites/${encodeURIComponent(token)}/preview`, { auth: false });
}

export async function inviteAcceptApi(payload: {
  token: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  password: string;
}) {
  return httpRequest<any>("/public/invites/accept", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getPublicCitiesApi() {
  return httpRequest<Array<{ value: string; label: string }>>("/public/cities");
}

export async function getPublicSalonsApi(city?: string) {
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  return httpRequest<SalonDiscoverySummary[]>(`/public/salons${query}`, { auth: false });
}

export async function getPublicSalonApi(slug: string) {
  return httpRequest<SalonDiscoverySummary>(`/public/salons/${encodeURIComponent(slug)}`, { auth: false });
}

export async function getPublicSalonPackagesApi(slug: string) {
  return httpRequest<PackageOption[]>(`/public/salons/${encodeURIComponent(slug)}/packages`, { auth: false });
}

export async function getSalonDayOptionsApi(slug: string, packageIds?: string[]) {
  const search = new URLSearchParams();
  if (Array.isArray(packageIds) && packageIds.length > 0) {
    search.set("package_ids", packageIds.join(","));
  }
  const query = search.toString() ? `?${search.toString()}` : "";
  return httpRequest<PurchaseDaySelection[]>(`/public/salons/${encodeURIComponent(slug)}/day-options${query}`, {
    auth: false,
  });
}

export async function getSalonTrainerOptionsApi(slug: string, packageId?: string, selectedDays?: PurchaseDaySelection[]) {
  const search = new URLSearchParams();
  if (packageId) search.set("package_id", packageId);
  if (Array.isArray(selectedDays) && selectedDays.length > 0) {
    search.set("selected_days", JSON.stringify(selectedDays));
  }
  const query = search.toString() ? `?${search.toString()}` : "";
  return httpRequest<TrainerOption[]>(`/public/salons/${encodeURIComponent(slug)}/trainers${query}`, {
    auth: false,
  });
}
