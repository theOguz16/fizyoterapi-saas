// Bu sayfa mobil uygulamada member akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { resolveBusinessHours } from "@/lib/business-hours";
import { getMemberAvailabilityApi, getMemberBookingsApi, getMemberHomeApi } from "@/lib/mobile-api";
import { useSession } from "@/providers/auth-session";
import { formatStatusLabel, getStatusTone } from "@/theme/components/calendar-agenda";
import { AppShell } from "@/theme/components/app-shell";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PROJECTED_WEEKS_AHEAD = 26;

function startOfIsoWeek(date: Date) {
  const dt = new Date(date);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function projectRecurringAvailabilityRows(rows: any[], from: Date, weeksAhead: number) {
  const to = new Date(from.getTime() + weeksAhead * WEEK_MS);
  const projected: any[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const templateStart = new Date(row?.starts_at);
    const templateEnd = new Date(row?.ends_at);
    if (Number.isNaN(templateStart.getTime()) || Number.isNaN(templateEnd.getTime()) || templateEnd <= templateStart) {
      continue;
    }

    let offset = 0;
    if (templateEnd <= from) {
      offset = Math.floor((from.getTime() - templateStart.getTime()) / WEEK_MS);
    }

    let occurrenceStart = new Date(templateStart.getTime() + offset * WEEK_MS);
    let occurrenceEnd = new Date(templateEnd.getTime() + offset * WEEK_MS);

    while (occurrenceEnd <= from) {
      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }

    while (occurrenceStart < to) {
      const key = `${String(row?.package_title || "")}|${occurrenceStart.toISOString()}|${occurrenceEnd.toISOString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        projected.push({
          ...row,
          starts_at: occurrenceStart.toISOString(),
          ends_at: occurrenceEnd.toISOString(),
        });
      }
      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }
  }

  return projected.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export default function MemberCalendarScreen() {
  const router = useRouter();
  const { pendingPaymentRequest } = useSession();
  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);
  const bookingsQuery = useQuery({
    queryKey: ["member-bookings-calendar"],
    queryFn: getMemberBookingsApi,
  });
  const availabilityQuery = useQuery({
    queryKey: ["member-availability-calendar"],
    queryFn: getMemberAvailabilityApi,
  });
  const homeQuery = useQuery({
    queryKey: ["member-home-calendar"],
    queryFn: getMemberHomeApi,
  });

  const bookings = useMemo(() => {
    const base = Array.isArray(bookingsQuery.data) ? bookingsQuery.data : Array.isArray((bookingsQuery.data as any)?.items) ? (bookingsQuery.data as any).items : [];
    return base.filter((booking: any) => !["CANCELED", "CANCELLED"].includes(String(booking?.status || "").toUpperCase()));
  }, [bookingsQuery.data]);

  const events = useMemo(
    () =>
      bookings.map((booking: any) => ({
        id: String(booking.id),
        title: booking.session_title || booking.lesson_category_label || "Ders",
        subtitle: `${booking.trainer_full_name || "Eğitmen"} • ${booking.package_title || booking.package_name || "Planlı seans"}`,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        badgeLabel: booking.pending_schedule_change ? "Saat Onayı Bekliyor" : formatStatusLabel(booking.status),
        badgeTone: booking.pending_schedule_change ? "warning" : getStatusTone(booking.status),
        onPress: () => router.push(`/(member)/booking/${booking.id}` as never),
      })),
    [bookings, router]
  );
  const approvedAvailabilityEvents = useMemo(() => {
    const rows = Array.isArray(availabilityQuery.data) ? availabilityQuery.data : [];
    const projectedRows = projectRecurringAvailabilityRows(rows, startOfIsoWeek(new Date()), PROJECTED_WEEKS_AHEAD);
    const bookingKeys = new Set(
      bookings.map((booking: any) => `${String(booking.starts_at || "")}|${String(booking.ends_at || "")}`)
    );

    return projectedRows
      .filter((row: any) => row?.starts_at)
      .filter((row: any) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
      .map((row: any, index: number) => ({
        id: `approved-availability-${index}-${String(row.starts_at)}`,
        title: row.package_title || "Onaylı saat tercihin",
        subtitle: "Admin onayı sonrası kaydedilen uygunluk",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: "Onaylandı",
        badgeTone: "info" as const,
      }));
  }, [availabilityQuery.data, bookings]);
  const pendingAvailabilityEvents = useMemo(() => {
    const rows = Array.isArray(pendingPaymentRequest?.selected_days) ? pendingPaymentRequest.selected_days : [];
    const bookingKeys = new Set(
      bookings.map((booking: any) => `${String(booking.starts_at || "")}|${String(booking.ends_at || "")}`)
    );

    return rows
      .filter((row: any) => row?.starts_at)
      .filter((row: any) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
      .map((row: any, index: number) => ({
        id: `pending-availability-${index}-${String(row.starts_at)}`,
        title: row.label || "Saat tercihin",
        subtitle: "Salon onayı bekleniyor",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: "Onay bekliyor",
        badgeTone: "warning" as const,
      }));
  }, [bookings, pendingPaymentRequest?.selected_days]);
  const schedulerEvents = useMemo(
    () => [...pendingAvailabilityEvents, ...approvedAvailabilityEvents, ...events],
    [approvedAvailabilityEvents, events, pendingAvailabilityEvents]
  );
  const businessHours = useMemo(() => resolveBusinessHours(homeQuery.data?.calendar?.business_hours), [homeQuery.data?.calendar?.business_hours]);

  return (
    <AppShell
      title="Takvim"
      subtitle="Ders programını takip et."
      icon="calendar"
      refreshing={bookingsQuery.isRefetching || availabilityQuery.isRefetching || homeQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
        void availabilityQuery.refetch();
        void homeQuery.refetch();
      }}
    >
      <WeeklyScheduler
        mode="member"
        events={schedulerEvents}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Programlanan dersler ve admin onayı sonrası kaydedilen saatlerin burada listelenir."
        businessHours={businessHours}
        hideEmptyState
      />
    </AppShell>
  );
}
