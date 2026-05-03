import type { MemberBookingDraft } from "@/providers/app-flow";

type GroupClassLike = {
  label?: string | null;
  weekday_label?: string | null;
  lesson_name?: string | null;
  group_title?: string | null;
  group_class_id?: string | null;
  is_group_class?: boolean | null;
  recurrence_label?: string | null;
  special_date?: string | null;
  price?: string | number | null;
  joined_count?: number | null;
  capacity?: number | null;
  requires_admin_approval?: boolean | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
};

export function isGroupClassBookingFlow(draft: Pick<MemberBookingDraft, "lessonMode" | "allowDropInBooking">) {
  return draft.allowDropInBooking || String(draft.lessonMode || "").toUpperCase() === "GROUP";
}

export function filterGroupClassSlotsForSelection<T extends GroupClassLike>(
  slots: T[],
  draft: Pick<MemberBookingDraft, "lessonMode" | "allowDropInBooking" | "selectedSubLesson">
) {
  if (!isGroupClassBookingFlow(draft)) return slots;
  const selectedLesson = String(draft.selectedSubLesson || "").trim().toLocaleLowerCase("tr-TR");
  return slots.filter((slot) => {
    const lessonName = String(slot.lesson_name || slot.group_title || "").trim().toLocaleLowerCase("tr-TR");
    if (selectedLesson && lessonName) {
      return lessonName === selectedLesson;
    }
    return slot.is_group_class !== false;
  });
}

export function getGroupClassDisplayName(slot: GroupClassLike) {
  return String(slot.lesson_name || slot.group_title || "").trim();
}

export function getGroupClassScheduleLabel(slot: GroupClassLike) {
  const recurrence = String(slot.recurrence_label || "").trim();
  if (recurrence) return recurrence;
  const specialDate = String(slot.special_date || "").trim();
  if (specialDate) return `Özel tarih • ${specialDate}`;
  return "Tek seferlik plan";
}

export function getGroupClassAudienceLabel(scope?: GroupClassLike["notification_scope"]) {
  return scope === "INVITED_MEMBERS" ? "Sadece davetliler" : "Salondaki herkese";
}

export function getGroupClassCapacityLabel(slot: GroupClassLike) {
  const joined = Number(slot.joined_count || 0);
  const capacity = Number(slot.capacity || 0);
  if (capacity > 0) return `${joined}/${capacity} katılımcı`;
  if (joined > 0) return `${joined} katılımcı`;
  return "Kontenjan açık";
}

export function formatGroupClassPrice(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Ücret bekleniyor";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${new Intl.NumberFormat("tr-TR").format(numeric)} TL`;
}
