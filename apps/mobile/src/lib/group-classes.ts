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
  starts_at?: string | null;
  price?: string | number | null;
  joined_count?: number | null;
  capacity?: number | null;
  requires_admin_approval?: boolean | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
};

export function isGroupClassBookingFlow(draft: Pick<MemberBookingDraft, "lessonMode" | "allowDropInBooking">) {
  return draft.allowDropInBooking || String(draft.lessonMode || "").toUpperCase() === "GROUP";
}

type GroupClassLikeSlot = {
  lesson_name?: string | null;
  group_title?: string | null;
  is_group_class?: boolean | null;
  group_class_id?: string | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
  requires_admin_approval?: boolean | null;
};

export function filterGroupClassSlotsForSelection<T extends GroupClassLikeSlot>(
  slots: T[],
  input: {
    lessonMode?: string | null;
    allowDropInBooking?: boolean | null;
    selectedSubLesson?: string | null;
  }
): T[] {
  if (
    !isGroupClassBookingFlow({
      lessonMode: input.lessonMode || undefined,
      allowDropInBooking: input.allowDropInBooking ?? undefined,
    })
  ) {
    return slots;
  }

  const selectedLessonName = String(input.selectedSubLesson || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

  return slots.filter((slot) => {
    if (slot.is_group_class !== true) return false;

    if (!selectedLessonName) return true;

    const lessonName = String(slot.lesson_name || slot.group_title || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    return lessonName === selectedLessonName;
  });
}

export function getGroupClassDisplayName(slot: GroupClassLike) {
  return String(slot.lesson_name || slot.group_title || "").trim();
}

export function formatGroupClassDate(value?: string | null) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatGroupClassTime(value?: string | null) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatGroupClassDateTime(value?: string | null) {
  const dateLabel = formatGroupClassDate(value);
  const timeLabel = formatGroupClassTime(value);
  return [dateLabel, timeLabel].filter(Boolean).join(" • ");
}

export function getGroupClassScheduleLabel(slot: GroupClassLike) {
  const recurrence = String(slot.recurrence_label || "").trim();
  if (recurrence) return recurrence;
  const specialDate = String(slot.special_date || "").trim();
  const formattedSpecialDate = formatGroupClassDate(specialDate ? `${specialDate}T00:00:00` : slot.starts_at);
  if (formattedSpecialDate) return `Özel tarih • ${formattedSpecialDate}`;
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
