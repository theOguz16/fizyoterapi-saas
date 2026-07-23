// Mobile API member domain endpointleri.
import { httpRequest, httpRequestEnvelope } from "../http-client";
import type { GroupClassSession, MemberAttendanceHistoryItem, MemberAttendanceResponse, MemberChangeRequest, MemberGroupClassWaitlist, MemberOwnedPackage, MemberPurchaseDraft, PaymentRequest } from "./types";

export async function createSalonApplicationApi(payload: { tenant_slug: string; note?: string }) {
  // Uye satin alma akisi ilerledikce secimler note/payload icinde tasinabiliyor.
  // Backend onay aninda bunlari MobilePurchaseSyncService ile kalici verilere ceviriyor.
  return httpRequest<any>("/member/salon-applications", {
    method: "POST",
    body: payload,
  });
}

export async function createMemberPaymentRequestApi(payload: MemberPurchaseDraft) {
  return httpRequest<PaymentRequest>("/member/purchase-requests", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberPaymentRequestsApi() {
  return httpRequest<PaymentRequest[]>("/member/purchase-requests");
}

export async function createMemberChangeRequestApi(payload: {
  type: MemberChangeRequest["type"];
  package_id?: string;
  trainer_id?: string;
  note?: string;
}) {
  return httpRequest<MemberChangeRequest>("/member/change-requests", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberChangeRequestsApi() {
  return httpRequest<MemberChangeRequest[]>("/member/change-requests");
}

export async function getMySalonApplicationsApi() {
  return httpRequest<any>("/member/salon-applications/me");
}

export async function leaveSalonMembershipApi() {
  return httpRequest<any>("/member/salon-applications/leave", {
    method: "POST",
  });
}

export async function getMemberHomeApi() {
  return httpRequest<any>("/member/home");
}

export async function getMemberPackagesApi() {
  return httpRequest<any>("/member/packages");
}

export async function getMemberMyPackagesApi() {
  return httpRequest<MemberOwnedPackage[]>("/member/packages/my-packages");
}

export async function getMemberAttendanceHistoryApi() {
  return httpRequest<MemberAttendanceHistoryItem[]>("/member/attendance/history");
}

export async function patchMemberWeeklyTarget(weekly_class_hours: number) {
  return httpRequest<any>("/member/home/weekly-class-hours", {
    method: "PATCH",
    body: { weekly_class_hours },
  });
}

export async function getMemberAttendanceApi(): Promise<MemberAttendanceResponse> {
  const response = await httpRequestEnvelope<MemberAttendanceHistoryItem[]>("/member/attendance/history");
  return response as unknown as MemberAttendanceResponse;
}

export async function getMemberBookingsApi() {
  return httpRequest<any>("/member/bookings");
}

export async function getMemberScheduleChangeRequestsApi() {
  return httpRequest<any>("/member/schedule-change-requests");
}

export async function resolveMemberScheduleChangeRequestApi(id: string, decision: "APPROVE" | "REJECT") {
  return httpRequest<any>(`/member/schedule-change-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { decision },
  });
}

export async function getMemberBookingByIdApi(id: string) {
  return httpRequest<any>(`/member/bookings/${id}`);
}

export async function getMemberAvailabilityApi() {
  return httpRequest<any>("/member/availability");
}

export async function saveMemberAvailabilityApi(payload: {
  mode?: "REPLACE_WEEK" | "APPEND";
  slots: Array<{ starts_at: string; ends_at: string; package_id?: string; note?: string }>;
}) {
  return httpRequest<{
    items: unknown[];
    weekly_plan: {
      weekly_class_hours: number;
      selected_slots: number;
      trainer_free_slots: number;
      required_slots: number;
      required_trainer_free_slots: number;
      is_valid: boolean;
      mode: "REPLACE_WEEK" | "APPEND";
      message: string;
    };
  }>("/member/availability", {
    method: "POST",
    body: payload,
  });
}

export async function cancelMemberBookingApi(id: string, confirmLateCancellation = false) {
  return httpRequest<any>(`/member/bookings/${id}/cancel`, {
    method: "PATCH",
    body: { confirm_late_cancellation: confirmLateCancellation },
  });
}

export async function getMemberReferralsApi() {
  return httpRequest<any>("/member/referrals");
}

export async function createMemberReferralApi(payload: { invitee_name: string; invitee_phone_or_email: string }) {
  return httpRequest<any>("/member/referrals", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberMeasurementsApi() {
  return httpRequest<any>("/member/measurements");
}

export async function createMemberMeasurementApi(payload: {
  measured_at?: string;
  height_cm?: string | number;
  weight_kg?: string | number;
  fat_percent?: string | number;
  muscle_kg?: string | number;
  extras?: Record<string, unknown>;
}) {
  return httpRequest<any>("/member/measurements", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberQrApi() {
  return httpRequest<any>("/member/qr");
}

export async function getMemberGroupClassesApi() {
  return httpRequest<GroupClassSession[]>("/member/group-classes");
}

export async function joinMemberGroupClassApi(id: string) {
  return httpRequest<any>(`/member/group-classes/${encodeURIComponent(id)}/join`, {
    method: "POST",
  });
}

export async function leaveMemberGroupClassApi(id: string) {
  return httpRequest<any>(`/member/group-classes/${encodeURIComponent(id)}/leave`, {
    method: "DELETE",
  });
}

export async function getMemberGroupClassWaitlistApi(id: string) {
  return httpRequest<MemberGroupClassWaitlist>(`/member/group-classes/${encodeURIComponent(id)}/waitlist`);
}

export async function joinMemberGroupClassWaitlistApi(id: string) {
  return httpRequest<MemberGroupClassWaitlist>(`/member/group-classes/${encodeURIComponent(id)}/waitlist`, {
    method: "POST",
  });
}

export async function leaveMemberGroupClassWaitlistApi(id: string) {
  return httpRequest<MemberGroupClassWaitlist>(`/member/group-classes/${encodeURIComponent(id)}/waitlist`, {
    method: "DELETE",
  });
}
