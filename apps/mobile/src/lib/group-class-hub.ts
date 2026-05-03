import * as SecureStore from "expo-secure-store";
import { LOCAL_GROUP_CLASSES_KEY } from "./local-preferences";

export type LocalGroupClass = {
  id: string;
  tenant_slug: string;
  lesson_name: string;
  trainer_name?: string | null;
  package_id: string;
  package_title: string;
  starts_at: string;
  ends_at: string;
  weekday_label: string;
  time_range_label: string;
  recurrence_label?: string | null;
  special_date?: string | null;
  price?: number | null;
  capacity?: number | null;
  joined_count?: number | null;
  invited_member_count?: number | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
  requires_admin_approval?: boolean | null;
  invited_members?: string[];
};

function buildWeekdayLabel(startsAt: string) {
  return new Date(startsAt).toLocaleDateString("tr-TR", { weekday: "long" });
}

function buildTimeRangeLabel(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const end = new Date(endsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${start} - ${end}`;
}

export async function getLocalGroupClasses() {
  try {
    const raw = await SecureStore.getItemAsync(LOCAL_GROUP_CLASSES_KEY);
    if (!raw) return [] as LocalGroupClass[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalGroupClass[]) : [];
  } catch {
    return [] as LocalGroupClass[];
  }
}

async function saveLocalGroupClasses(rows: LocalGroupClass[]) {
  await SecureStore.setItemAsync(LOCAL_GROUP_CLASSES_KEY, JSON.stringify(rows));
  return rows;
}

export async function upsertLocalGroupClass(input: Omit<LocalGroupClass, "id" | "weekday_label" | "time_range_label"> & { id?: string }) {
  const current = await getLocalGroupClasses();
  const nextRow: LocalGroupClass = {
    ...input,
    id: input.id || `group-${Date.now()}`,
    weekday_label: buildWeekdayLabel(input.starts_at),
    time_range_label: buildTimeRangeLabel(input.starts_at, input.ends_at),
  };
  const next = current.some((row) => row.id === nextRow.id) ? current.map((row) => (row.id === nextRow.id ? nextRow : row)) : [nextRow, ...current];
  await saveLocalGroupClasses(next);
  return nextRow;
}

export async function deleteLocalGroupClass(id: string) {
  const current = await getLocalGroupClasses();
  const next = current.filter((row) => row.id !== id);
  await saveLocalGroupClasses(next);
}

export async function joinLocalGroupClass(id: string) {
  const current = await getLocalGroupClasses();
  const next = current.map((row) =>
    row.id === id
      ? {
          ...row,
          joined_count: Number(row.joined_count || 0) + 1,
        }
      : row
  );
  await saveLocalGroupClasses(next);
}

export function toPurchaseDaySelection(row: LocalGroupClass) {
  return {
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    label: `${row.weekday_label} • ${row.time_range_label}`,
    package_id: row.package_id,
    package_title: row.package_title,
    weekday_label: row.weekday_label,
    time_range_label: row.time_range_label,
    lesson_name: row.lesson_name,
    group_class_id: row.id,
    group_title: row.lesson_name,
    is_group_class: true,
    is_recurring: Boolean(row.recurrence_label),
    recurrence_label: row.recurrence_label || null,
    special_date: row.special_date || null,
    price: row.price || null,
    capacity: row.capacity || null,
    joined_count: row.joined_count || 0,
    trainer_can_invite_members: true,
    notification_scope: row.notification_scope || "SALON_MEMBERS",
    requires_admin_approval: row.requires_admin_approval ?? true,
  };
}

export function toTrainerScheduleEntry(row: LocalGroupClass) {
  return {
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    session_title: row.lesson_name,
    lesson_name: row.lesson_name,
    package_title: row.package_title,
    package_name: row.package_title,
    status: row.requires_admin_approval ? "PENDING" : "APPROVED",
    is_group_class: true,
    recurrence_label: row.recurrence_label || null,
    price: row.price || null,
    requires_admin_approval: row.requires_admin_approval ?? true,
    notification_scope: row.notification_scope || "SALON_MEMBERS",
    invited_member_count: row.invited_member_count || 0,
    joined_member_count: row.joined_count || 0,
  };
}

export function toAdminCalendarEntry(row: LocalGroupClass) {
  return {
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    trainer_full_name: row.trainer_name || "Trainer",
    package_title: row.package_title,
    lesson_name: row.lesson_name,
    session_title: row.lesson_name,
    status: row.requires_admin_approval ? "PENDING" : "APPROVED",
    is_group_class: true,
    recurrence_label: row.recurrence_label || null,
    price: row.price || null,
    notification_scope: row.notification_scope || "SALON_MEMBERS",
  };
}
