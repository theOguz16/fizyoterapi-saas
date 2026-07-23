// Mobile API trainer domain endpointleri.
import { httpRequest } from "../http-client";
import type { BookingReschedulePayload, GroupClassSession, QrScanContext, QrScanResult, StructuredTrainerNote, TrainerAssignedPackage, TrainerAvailabilityEntry, TrainerGroupClassFormOptions, TrainerMemberAttendance, TrainerMemberDetail, TrainerMemberListItem, TrainerMemberMeasurement, TrainerMemberNoteState, TrainerMemberNotes, TrainerRequestCenterItem, TrainerScheduleChangeRequest, TrainerScheduleEntry } from "./types";

type TrainerBookingFormOptions = {
  packages?: TrainerAssignedPackage[];
  member_package_diagnostics?: Record<string, { reason_codes?: string[] }>;
  [key: string]: unknown;
};

export async function getTrainerQrApi() {
  return httpRequest<any>("/trainer/qr");
}

export async function getTrainerTodayApi() {
  return httpRequest<any>("/trainer/today");
}

export async function getTrainerBookingsApi() {
  return httpRequest<TrainerScheduleEntry[]>("/trainer/bookings");
}

export async function getTrainerGroupClassesApi() {
  return httpRequest<GroupClassSession[]>("/trainer/group-classes");
}

export async function getTrainerGroupClassFormOptionsApi() {
  return httpRequest<TrainerGroupClassFormOptions>("/trainer/group-classes/form-options");
}

export async function createTrainerGroupClassApi(payload: {
  title: string;
  starts_at: string;
  ends_at: string;
  related_package_id?: string | null;
  capacity?: number;
  lesson_category?: string | null;
  price?: string | number | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
  requires_admin_approval?: boolean;
  invited_member_count?: number;
  invited_member_ids?: string[];
  recurrence_label?: string | null;
  special_date?: string | null;
}) {
  return httpRequest<GroupClassSession>("/trainer/group-classes", {
    method: "POST",
    body: payload,
  });
}

export async function updateTrainerGroupClassApi(
  id: string,
  payload: {
    title?: string;
    starts_at?: string;
    ends_at?: string;
    related_package_id?: string | null;
    capacity?: number;
    lesson_category?: string | null;
    price?: string | number | null;
    notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
    requires_admin_approval?: boolean;
    invited_member_count?: number;
    invited_member_ids?: string[];
    recurrence_label?: string | null;
    special_date?: string | null;
    status?: string | null;
  }
) {
  return httpRequest<GroupClassSession>(`/trainer/group-classes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteTrainerGroupClassApi(id: string) {
  return httpRequest<any>(`/trainer/group-classes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getTrainerAvailabilitiesApi() {
  return httpRequest<TrainerAvailabilityEntry[]>("/trainer/bookings/availabilities");
}

export async function createTrainerScheduleChangeRequestApi(
  id: string,
  payload: { starts_at?: string; ends_at?: string; member_id: string; note?: string | null }
) {
  return httpRequest<TrainerScheduleChangeRequest>(`/trainer/bookings/${encodeURIComponent(id)}/schedule-change-request`, {
    method: "POST",
    body: payload,
  });
}

export async function getTrainerBookingFormOptionsApi() {
  return httpRequest<TrainerBookingFormOptions>("/trainer/bookings/form-options");
}

export async function getTrainerAssignedPackagesApi() {
  const response = await getTrainerBookingFormOptionsApi();
  return Array.isArray(response.packages) ? response.packages : [];
}

export async function createTrainerBookingApi(payload: {
  member_id: string;
  starts_at: string;
  ends_at: string;
  status?: string;
  session_id?: string;
  meta: {
    package_id: string;
    package_title?: string | null;
    note?: string | null;
  };
}) {
  return httpRequest<any>("/trainer/bookings", {
    method: "POST",
    body: payload,
  });
}

export async function patchTrainerBookingStatusApi(
  id: string,
  payload: { status: string; starts_at?: string; ends_at?: string; meta?: Record<string, unknown> }
) {
  return httpRequest<any>(`/trainer/bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: payload,
  });
}

export async function markTrainerBookingNoShowApi(id: string) {
  return httpRequest<any>(`/trainer/bookings/${encodeURIComponent(id)}/no-show`, {
    method: "PATCH",
    body: { confirm_credit_charge: true },
  });
}

export async function getTrainerCheckinLogsApi(memberId?: string) {
  const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : "";
  return httpRequest<any>(`/trainer/checkin/logs${query}`);
}

export async function trainerManualCheckinApi(payload: { member_id?: string; manual_code?: string; session_id?: string }) {
  return httpRequest<QrScanResult>("/trainer/checkin/manual", {
    method: "POST",
    body: payload,
  });
}

export async function trainerQrCheckinApi(payload: { qr_code: string; session_id?: string; scan_context?: QrScanContext }) {
  return httpRequest<QrScanResult>("/trainer/checkin/qr", {
    method: "POST",
    body: payload,
  });
}

export async function getTrainerMembersApi() {
  return httpRequest<TrainerMemberListItem[]>("/trainer/members");
}

export async function getTrainerMemberDetailApi(id: string) {
  return httpRequest<TrainerMemberDetail>(`/trainer/members/${encodeURIComponent(id)}`);
}

export async function getTrainerMemberAttendanceApi(id: string) {
  return httpRequest<TrainerMemberAttendance[]>(`/trainer/members/${encodeURIComponent(id)}/attendance`);
}

export async function getTrainerMemberMeasurementsApi(id: string) {
  return httpRequest<TrainerMemberMeasurement[]>(`/trainer/members/${encodeURIComponent(id)}/measurements`);
}

export async function getTrainerMemberNotesApi(id: string) {
  return httpRequest<TrainerMemberNotes>(`/trainer/members/${encodeURIComponent(id)}/notes`);
}

export async function updateTrainerMemberNotesApi(
  id: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<TrainerMemberNoteState>(`/trainer/members/${encodeURIComponent(id)}/notes`, {
    method: "PUT",
    body: note,
  });
}

export async function createTrainerMemberNoteApi(
  id: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<TrainerMemberNoteState>(`/trainer/members/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    body: note,
  });
}

export async function patchTrainerMemberNoteApi(
  id: string,
  noteId: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<TrainerMemberNoteState>(`/trainer/members/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    body: note,
  });
}

export async function deleteTrainerMemberNoteApi(id: string, noteId: string) {
  return httpRequest<{ deleted: boolean }>(`/trainer/members/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
  });
}

export async function trainerRescheduleBookingApi(id: string, payload: BookingReschedulePayload) {
  return httpRequest<TrainerScheduleEntry>(`/trainer/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getTrainerRiskApi() {
  return httpRequest<any>("/trainer/risk/members");
}

export async function getTrainerScheduleChangeRequestsApi() {
  return httpRequest<TrainerRequestCenterItem[]>("/trainer/bookings/schedule-change-requests");
}

export async function sendTrainerBulkNotificationApi(payload: { member_ids: string[]; title: string; body: string }) {
  return httpRequest<any>("/trainer/bookings/bulk-notifications", { method: "POST", body: payload });
}
