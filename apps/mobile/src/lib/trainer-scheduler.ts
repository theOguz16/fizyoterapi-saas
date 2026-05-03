// Bu helper modulu mobil tarafta trainer scheduler ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export type TrainerAssignableSlot = {
  starts_at: string;
  ends_at: string;
};

export type TrainerScheduleRequest = {
  id: string;
  member_id: string;
  member_full_name: string;
  package_id?: string | null;
  package_title: string;
  note?: string | null;
  assignable_slots: TrainerAssignableSlot[];
};

export type TrainerScheduleBooking = {
  id: string;
  member_id?: string | null;
  member_full_name?: string | null;
  package_title?: string | null;
  assignable_slots?: TrainerAssignableSlot[] | null;
  starts_at: string;
  ends_at?: string | null;
};

export type ScheduleChangeNotificationCard = {
  id: string;
  booking_id: string;
  trainer_name?: string | null;
  session_title?: string | null;
  package_title?: string | null;
  current_starts_at: string;
  proposed_starts_at: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export function toSlotKey(startsAt: string) {
  const date = new Date(startsAt);
  const day = date.toISOString().slice(0, 10);
  const time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${day}-${time}`;
}

export function groupAssignableRequestsByDay<T extends { assignable_slots?: TrainerAssignableSlot[] | null }>(requests: T[]) {
  const map = new Map<string, T[]>();
  for (const request of requests) {
    for (const slot of request.assignable_slots || []) {
      const dayKey = String(slot.starts_at).slice(0, 10);
      map.set(dayKey, [...(map.get(dayKey) || []), request]);
    }
  }
  return map;
}

export function findSlotByKey(
  slotKey: string,
  slots: TrainerAssignableSlot[]
): TrainerAssignableSlot | null {
  return slots.find((slot) => toSlotKey(slot.starts_at) === slotKey) || null;
}

export function isSlotAllowed(slotKey: string, assignableSlots?: TrainerAssignableSlot[] | null) {
  if (!assignableSlots || assignableSlots.length === 0) return false;
  return assignableSlots.some((slot) => toSlotKey(slot.starts_at) === slotKey);
}

export function rebuildRequestFromCancelledBooking<T extends TrainerScheduleBooking>(booking: T) {
  return {
    id: `rebuild-${booking.id}`,
    member_id: String(booking.member_id || ""),
    member_full_name: booking.member_full_name || "Üye",
    package_title: booking.package_title || "Paket",
    assignable_slots: Array.isArray(booking.assignable_slots) ? booking.assignable_slots : [],
    note: "İptal sonrası tekrar planlanabilir",
  };
}
