// Mobile API subscription domain endpointleri.
import { httpRequest, httpRequestText } from "../http-client";
import type { AdminClinicSubscription, AdminRevenueReport, AdminSubscriptionHistoryItem } from "./types";

export async function createSubscriptionIntentApi(payload: {
  plan_id: string;
  clinic_name?: string;
  branch_count?: number;
  active_client_count?: number;
}) {
  return httpRequest<{
    status: string;
    plan_id: string;
    message: string;
  }>("/billing/subscription-intent", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getAdminClinicSubscriptionApi() {
  return httpRequest<AdminClinicSubscription>("/admin/clinic/subscription");
}

export async function startAdminClinicTrialApi() {
  return httpRequest<AdminClinicSubscription>("/admin/clinic/subscription/start-trial", {
    method: "POST",
  });
}

export async function syncAdminClinicSubscriptionApi() {
  return httpRequest<AdminClinicSubscription>("/admin/clinic/subscription/sync", {
    method: "POST",
  });
}

export async function getAdminSubscriptionHistoryApi() {
  return httpRequest<AdminSubscriptionHistoryItem[]>("/admin/clinic/subscription/history");
}

export async function getAdminRevenueReportApi(query?: { from?: string; to?: string; package_id?: string; trainer_id?: string }) {
  const search = new URLSearchParams();
  if (query?.from) search.set("from", query.from);
  if (query?.to) search.set("to", query.to);
  if (query?.package_id) search.set("package_id", query.package_id);
  if (query?.trainer_id) search.set("trainer_id", query.trainer_id);
  const qs = search.toString();
  return httpRequest<AdminRevenueReport>(`/admin/revenue/report${qs ? `?${qs}` : ""}`);
}

export async function getAdminRevenueCsvApi(query?: { from?: string; to?: string; package_id?: string; trainer_id?: string }) {
  const search = new URLSearchParams();
  if (query?.from) search.set("from", query.from);
  if (query?.to) search.set("to", query.to);
  if (query?.package_id) search.set("package_id", query.package_id);
  if (query?.trainer_id) search.set("trainer_id", query.trainer_id);
  return httpRequestText(`/admin/revenue/export.csv?${search.toString()}`);
}
