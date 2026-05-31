export type TrainerBookingInsight = {
  id?: string;
  status?: string | null;
  starts_at?: string | null;
  lesson_category_label?: string | null;
  session_title?: string | null;
  package_title?: string | null;
  member_full_name?: string | null;
};

export type TrainerSummary = {
  total: number;
  completed: number;
  uniqueLessons: string[];
  recentLessons: TrainerBookingInsight[];
};

export function isCanceledBookingStatus(value?: string | null) {
  return ["CANCELLED", "CANCELED"].includes(String(value || "").toUpperCase());
}

export function isCompletedBooking(item: TrainerBookingInsight, nowMs = Date.now()) {
  const status = String(item.status || "").toUpperCase();
  if (status === "COMPLETED") return true;
  if (isCanceledBookingStatus(status)) return false;
  const startsAt = item.starts_at ? new Date(item.starts_at) : null;
  return Boolean(startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() < nowMs);
}

export function buildTrainerSummary(bookings: TrainerBookingInsight[], nowMs = Date.now()): TrainerSummary {
  const activeRows = bookings.filter((item) => !isCanceledBookingStatus(item.status));
  const completedRows = activeRows.filter((item) => isCompletedBooking(item, nowMs));
  const uniqueLessons = Array.from(
    new Set(completedRows.map((item) => item.lesson_category_label || item.session_title || item.package_title).filter(Boolean))
  ) as string[];

  return {
    total: activeRows.length,
    completed: completedRows.length,
    uniqueLessons,
    recentLessons: completedRows.slice(0, 8),
  };
}

type RetentionReasonContainer = {
  breakdown?: {
    reasons?: unknown[];
  } | null;
  reason?: unknown;
  primary_reason?: unknown;
  reasom?: unknown;
  primary_reasom?: unknown;
};

export function getRetentionReasons(retention: RetentionReasonContainer | null | undefined) {
  const reasonsFromBreakdown = Array.isArray(retention?.breakdown?.reasons) ? retention.breakdown.reasons : [];
  const directReasons = [retention?.reason, retention?.primary_reason, retention?.reasom, retention?.primary_reasom].filter(Boolean);
  return [...reasonsFromBreakdown, ...directReasons].map((item) => String(item));
}
