// Mobile API admin domain endpointleri.
import { httpRequest } from "../http-client";
import type { AdminApprovalItem, AdminCampaign, AdminCampaignListResponse, AdminCompactMember, AdminMemberDetail, AdminMemberPackage, AdminMemberPackagesResponse, AdminNotificationLogItem, AdminPackage, AdminPackageAssignment, AdminPackageFormOptions, AdminRiskMemberItem, AdminTrainerEarnings, BookingReschedulePayload, GroupClassSession, QrScanResult } from "./types";

export async function getAdminDashboardApi() {
  return httpRequest<any>("/admin/dashboard");
}

export async function getAdminClinicQrApi() {
  return httpRequest<any>("/admin/clinic/qr");
}

export async function getAdminBookingsApi(query?: {
  from?: string;
  to?: string;
  trainer_id?: string;
  member_id?: string;
  status?: string;
}) {
  const search = new URLSearchParams();
  if (query?.from) search.set("from", query.from);
  if (query?.to) search.set("to", query.to);
  if (query?.trainer_id) search.set("trainer_id", query.trainer_id);
  if (query?.member_id) search.set("member_id", query.member_id);
  if (query?.status) search.set("status", query.status);
  const qs = search.toString();
  return httpRequest<any[]>(`/admin/bookings${qs ? `?${qs}` : ""}`);
}

export async function getAdminSessionsApi(query?: { status?: string }) {
  const search = new URLSearchParams();
  if (query?.status) search.set("status", query.status);
  const qs = search.toString();
  return httpRequest<GroupClassSession[]>(`/admin/sessions${qs ? `?${qs}` : ""}`);
}

export async function getAdminMobileApprovalsApi() {
  return httpRequest<AdminApprovalItem[]>("/admin/mobile-approvals");
}

export async function getAdminRiskMembersApi() {
  return httpRequest<AdminRiskMemberItem[]>(
    "/admin/risk/members?riskSegment=AT_RISK&memberActivity=ACTIVE&limit=100"
  );
}

export async function getAdminMembersApi() {
  return httpRequest<AdminCompactMember[]>("/admin/members");
}

export async function getAdminTrainersApi() {
  const trainers = await httpRequest<AdminCompactMember[]>("/admin/trainers");
  return trainers.map((item) => ({ ...item, role: "TRAINER" as const }));
}

export async function getAdminPackagesApi() {
  return httpRequest<AdminPackage[]>("/admin/packages");
}

export async function getAdminPackageFormOptionsApi() {
  return httpRequest<AdminPackageFormOptions>("/admin/packages/form-options");
}

export async function createAdminPackageApi(payload: {
  title: string;
  total_credits: number;
  duration_days: number;
  is_active?: boolean;
  is_visible?: boolean;
  is_public?: boolean;
  service_key: string;
  display_price?: number;
  trainer_commission_rate?: number;
  capacity?: number;
  summary?: string;
  lesson_mode?: string;
  sub_lessons?: string[];
  linked_group_class_ids?: string[];
  linked_group_class_titles?: string[];
  session_duration_minutes?: number;
  break_duration_minutes?: number;
}) {
  return httpRequest<AdminPackage>("/admin/packages", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminPackageApi(
  id: string,
  payload: {
    title?: string;
    total_credits?: number;
    duration_days?: number;
    is_active?: boolean;
    is_visible?: boolean;
    is_public?: boolean;
    service_key?: string;
    display_price?: number;
    trainer_commission_rate?: number;
    capacity?: number;
    summary?: string;
    lesson_mode?: string;
    sub_lessons?: string[];
    linked_group_class_ids?: string[];
    linked_group_class_titles?: string[];
    session_duration_minutes?: number;
    break_duration_minutes?: number;
  }
) {
  return httpRequest<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteAdminPackageApi(id: string) {
  return httpRequest<{ message?: string }>(`/admin/packages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminPackageAssignmentsApi(query?: unknown) {
  const filters =
    query && typeof query === "object" && !Array.isArray(query)
      ? (query as { trainer_id?: string; package_id?: string; is_active?: boolean })
      : {};
  const search = new URLSearchParams();
  if (filters.trainer_id) search.set("trainer_id", filters.trainer_id);
  if (filters.package_id) search.set("package_id", filters.package_id);
  if (filters.is_active !== undefined) search.set("is_active", String(filters.is_active));
  const qs = search.toString();
  return httpRequest<AdminPackageAssignment[]>(`/admin/package-trainers${qs ? `?${qs}` : ""}`);
}

export async function createAdminPackageAssignmentApi(payload: { package_id: string; trainer_id: string }) {
  return httpRequest<AdminPackageAssignment>("/admin/package-trainers", {
    method: "POST",
    body: payload,
  });
}

export async function deleteAdminPackageAssignmentApi(id: string) {
  return httpRequest<{ message?: string }>(`/admin/package-trainers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminMemberDetailApi(id: string) {
  const member = await httpRequest<AdminMemberDetail>(`/admin/members/${encodeURIComponent(id)}`);
  return { ...member, role: "MEMBER" as const };
}

export async function getAdminMemberPackagesApi(id: string) {
  return httpRequest<AdminMemberPackagesResponse>(`/admin/members/${encodeURIComponent(id)}/packages`);
}

export async function assignAdminMemberPackageApi(
  id: string,
  payload: {
    package_id: string;
    starts_at?: string;
    expires_at?: string | null;
  }
) {
  return httpRequest<AdminMemberPackage>(
    `/admin/members/${encodeURIComponent(id)}/packages`,
    {
      method: "POST",
      body: payload,
    }
  );

}

export async function adjustAdminMemberPackageCreditsApi(
  userPackageId: string,
  remaining_credits: number
) {
  return httpRequest<AdminMemberPackage>(
    `/admin/members/user-packages/${encodeURIComponent(userPackageId)}/credits`,
    {
      method: "PATCH",
      body: { remaining_credits },
    }
  );

}

export async function removeAdminMemberPackageApi(userPackageId: string) {
  return httpRequest<AdminMemberPackage>(
    `/admin/members/user-packages/${encodeURIComponent(userPackageId)}`,
    {
      method: "DELETE",
    }
  );

}

export async function getAdminTrainerDetailApi(id: string) {
  const trainer = await httpRequest<AdminMemberDetail>(`/admin/trainers/${encodeURIComponent(id)}`);
  return { ...trainer, role: "TRAINER" as const };
}

export async function getAdminMemberAttendanceApi(id: string) {
  return httpRequest<any[]>(`/admin/members/${encodeURIComponent(id)}/attendance`);
}

export async function getAdminMemberMeasurementsApi(id: string) {
  return httpRequest<any[]>(`/admin/members/${encodeURIComponent(id)}/measurements`);
}

export async function getAdminMemberRetentionApi(id: string) {
  return httpRequest<any>(`/admin/members/${encodeURIComponent(id)}/retention-score`);
}

export async function getAdminTrainerSkillsApi(id: string) {
  return httpRequest<string[]>(`/admin/trainers/${encodeURIComponent(id)}/skills`);
}

export async function getAdminTrainerEarningsApi(id: string) {
  return httpRequest<AdminTrainerEarnings>(`/admin/trainers/${encodeURIComponent(id)}/earnings`);
}

export async function approveAdminMobileItemApi(id: string, decision: "APPROVE" | "REJECT") {
  return httpRequest<AdminApprovalItem>(`/admin/mobile-approvals/${id}`, {
    method: "PATCH",
    body: { decision },
  });
}

export async function adminSalonEntryScanApi(payload: { qr_code?: string; manual_code?: string }) {
  return httpRequest<QrScanResult>("/admin/qr/scan-entry", {
    method: "POST",
    body: payload,
  });
}

export async function adminRescheduleBookingApi(id: string, payload: BookingReschedulePayload) {
  return httpRequest<any>(`/admin/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: payload,
  });
}

export async function triggerAdminNotificationTemplate(payload: {
  type: string;
  send_now?: boolean;
  audience?: string;
}) {
  return httpRequest<any>("/admin/settings/notifications/trigger", {
    method: "POST",
    body: payload,
  });
}

export async function getAdminNotificationLogsApi(limit = 40) {
  return httpRequest<AdminNotificationLogItem[]>(
    `/admin/settings/notifications/logs?limit=${encodeURIComponent(String(limit))}`
  );
}

export async function getAdminSettingsApi() {
  return httpRequest<any>("/admin/settings");
}

export async function updateAdminSettingsApi(payload: Record<string, unknown>) {
  return httpRequest<any>("/admin/settings", {
    method: "PUT",
    body: payload,
  });
}

export async function getAdminCampaignsApi() {
  return httpRequest<AdminCampaignListResponse>("/admin/campaigns");
}

export async function getAdminCampaignApi(id: string) {
  return httpRequest<{ campaign: AdminCampaign; campaign_type: "REFERRAL" | "ATTENDANCE" }>(
    `/admin/campaigns/${encodeURIComponent(id)}`
  );
}

export async function createAdminCampaignApi(payload: {
  name: string;
  audience: "ALL" | "RISK" | "NEW";
  trigger_type: "REFERRAL" | "ATTENDANCE";
  trigger_count: number;
  reward_type: "DISCOUNT" | "FREE_CLASS";
  reward_value: number;
  reward_target?: "REFERRER" | "REFERRED" | "BOTH";
  is_active?: boolean;
}) {
  return httpRequest<any>("/admin/campaigns", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminCampaignApi(
  id: string,
  payload: {
    name?: string;
    audience?: "ALL" | "RISK" | "NEW";
    trigger_count?: number;
    reward_type?: "DISCOUNT" | "FREE_CLASS";
    reward_value?: number;
    reward_target?: "REFERRER" | "REFERRED" | "BOTH";
    is_active?: boolean;
  }
) {
  return httpRequest<any>(`/admin/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}
