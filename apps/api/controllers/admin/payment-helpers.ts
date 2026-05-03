// Bu controller admin tarafindaki payment helpers endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { BookingPaymentStatus } from "../../entities/booking.entity";

export function resolveBookingPaymentStatus(raw: unknown) {
  const normalized = String(raw ?? BookingPaymentStatus.REQUESTED).toUpperCase();
  const validStatuses = new Set(Object.values(BookingPaymentStatus));
  return validStatuses.has(normalized as BookingPaymentStatus)
    ? (normalized as BookingPaymentStatus)
    : BookingPaymentStatus.REQUESTED;
}

export function normalizePaymentNote(raw: unknown, fallback?: string | null) {
  if (typeof raw !== "string") return fallback ?? undefined;
  const trimmed = raw.trim();
  if (!trimmed) return fallback ?? undefined;
  return trimmed.slice(0, 500);
}
