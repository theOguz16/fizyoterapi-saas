// Bu helper modulu mobil tarafta schedule change requests ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "clinerva.schedule_change_requests.v1";

export type ScheduleChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ScheduleChangeRequestRecord = {
  id: string;
  bookingId: string;
  memberId?: string | null;
  memberName?: string | null;
  trainerId?: string | null;
  trainerName?: string | null;
  tenantName?: string | null;
  sessionTitle?: string | null;
  packageTitle?: string | null;
  currentStartsAt: string;
  currentEndsAt?: string | null;
  proposedStartsAt: string;
  proposedEndsAt?: string | null;
  status: ScheduleChangeRequestStatus;
  createdAt: string;
  note?: string | null;
};

async function readAll() {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [] as ScheduleChangeRequestRecord[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScheduleChangeRequestRecord[]) : [];
  } catch {
    return [] as ScheduleChangeRequestRecord[];
  }
}

async function writeAll(rows: ScheduleChangeRequestRecord[]) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(rows));
  return rows;
}

export async function listScheduleChangeRequests() {
  return readAll();
}

export async function listPendingScheduleChangeRequestsForMember(memberId?: string | null) {
  const rows = await readAll();
  if (!memberId) return [];
  return rows.filter((row) => row.memberId === memberId && row.status === "PENDING");
}

export async function findPendingScheduleChangeForBooking(bookingId: string) {
  const rows = await readAll();
  return rows.find((row) => row.bookingId === bookingId && row.status === "PENDING") || null;
}

export async function createScheduleChangeRequest(
  payload: Omit<ScheduleChangeRequestRecord, "id" | "createdAt" | "status">
) {
  const rows = await readAll();
  const next: ScheduleChangeRequestRecord = {
    ...payload,
    id: `schedule-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };
  return writeAll([next, ...rows]);
}

export async function approveScheduleChangeRequest(id: string) {
  const rows = await readAll();
  return writeAll(
    rows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: "APPROVED" as const,
          }
        : row
    )
  );
}

export async function rejectScheduleChangeRequest(id: string) {
  const rows = await readAll();
  return writeAll(
    rows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: "REJECTED" as const,
          }
        : row
    )
  );
}

export function applyApprovedScheduleChanges<T extends Record<string, any>>(rows: T[]) {
  return listScheduleChangeRequests().then((requests) => {
    const approved = requests.filter((row) => row.status === "APPROVED");
    if (approved.length === 0) return rows;
    return rows.map((row) => {
      const match = approved.find((request) => String(request.bookingId) === String(row.id));
      if (!match) return row;
      return {
        ...row,
        starts_at: match.proposedStartsAt,
        ends_at: match.proposedEndsAt,
        status: "RESCHEDULED",
      };
    });
  });
}
