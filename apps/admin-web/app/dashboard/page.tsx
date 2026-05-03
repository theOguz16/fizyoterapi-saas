"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { toast } from "sonner";
import { Activity, CalendarCheck2, CalendarClock, ChevronDown, Coins, Dumbbell, Mail, PackageOpen, Phone, ShieldAlert, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppIcon } from "@/components/ui/app-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { bookingStatusLabel, riskLabel } from "@/lib/presentation";
import { useRequireRole } from "@/lib/require-role";
import { httpRequest } from "@/lib/http-client";
import { buildBusinessHours, normalizeWorkingDays, slotDurationText } from "@/app/trainer/bookings/booking-utils";
import type { CalendarBusinessHours } from "@/app/trainer/bookings/booking-types";

const AdminCombinedBookingCalendar = dynamic(
  () => import("@/app/admin/sessions/AdminCombinedBookingCalendar"),
  { ssr: false }
);

type DashboardPayload = {
  tenant_id: string;
  kpis: {
    active_trainers: number;
    active_members: number;
    at_risk_members: number;
    todays_bookings: number;
    todays_sessions: number;
  };
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  package_sales: {
    weekly_credits_sold: number;
    monthly_credits_sold: number;
    weekly_pack_8_count: number;
    weekly_pack_4_count: number;
  };
  risk_preview: Array<{
    member_id: string;
    full_name: string;
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW";
    reasons: string[];
  }>;
  spotlight: {
    trainers: Array<{
      id: string;
      first_name?: string;
      last_name?: string;
      email: string;
      is_active: boolean;
    }>;
    members: Array<{
      id: string;
      first_name?: string;
      last_name?: string;
      email: string;
      is_active: boolean;
    }>;
  };
};

type TrainerOption = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  is_active: boolean;
};

type AdminBookingItem = {
  id: string;
  member_id: string;
  member_full_name?: string | null;
  member_email?: string | null;
  member_phone?: string | null;
  trainer_id: string;
  trainer_full_name?: string | null;
  trainer_email?: string | null;
  session_id?: string | null;
  starts_at: string;
  ends_at: string;
  status: "PENDING" | "APPROVED" | "CANCELED" | "RESCHEDULED";
  session_title?: string | null;
  lesson_category?: string | null;
  lesson_category_label?: string | null;
  package_title?: string | null;
  package_display_price?: string | null;
};

type SettingsPayload = {
  data?: {
    profile?: {
      business_hours?: CalendarBusinessHours;
    };
  };
};

type BookingStatusFilter = "ALL" | "PENDING" | "APPROVED" | "CANCELED" | "RESCHEDULED";

const DEFAULT_CALENDAR_CONFIG: CalendarBusinessHours = {
  timezone: "Europe/Istanbul",
  working_days: [1, 2, 3, 4, 5, 6, 7],
  start_time: "09:00",
  end_time: "18:00",
  lunch_break_start: "12:00",
  lunch_break_end: "13:00",
  slot_minutes: 60,
};

const TRAINER_COLOR_PALETTE = [
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#6366F1",
  "#EF4444",
  "#14B8A6",
  "#8B5CF6",
  "#EC4899",
];

function formatPersonLabel(person?: { first_name?: string; last_name?: string; email?: string | null } | null) {
  if (!person) return "Belirtilmedi";
  const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return fullName || person.email || "Belirtilmedi";
}

function compactPersonLabel(label?: string | null) {
  if (!label) return "Belirtilmedi";
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].slice(0, 1)}.`;
  return label;
}

function BookingDetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="detail-pill w-full items-start gap-3 px-4 py-3">
      <span className="shrink-0 rounded-2xl bg-sky-50 p-2 text-sky-600">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span className="break-all text-sm font-medium text-slate-900">{value}</span>
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarBusinessHours>(DEFAULT_CALENDAR_CONFIG);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState("");
  const [calendarTrainerFilter, setCalendarTrainerFilter] = useState("");
  const [calendarMemberQuery, setCalendarMemberQuery] = useState("");
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<BookingStatusFilter>("ALL");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const visibleRangeRef = useRef<{ from: string | null; to: string | null }>({ from: null, to: null });
  const lastDatesSetKeyRef = useRef("");
  const tryFormatter = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([loadDashboard(), loadTrainers(), loadCalendarConfig()]).catch(() =>
      toast.error("Dashboard verisi yüklenemedi")
    );
  }, [status]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!visibleRangeRef.current.from && !visibleRangeRef.current.to) return;
    loadBookings(visibleRangeRef.current.from, visibleRangeRef.current.to).catch(() =>
      toast.error("Birleşik takvim güncellenemedi")
    );
  }, [calendarTrainerFilter, calendarStatusFilter, status]);

  useEffect(() => {
    if (selectedBookingId && !bookings.some((row) => row.id === selectedBookingId)) {
      setSelectedBookingId("");
    }
  }, [bookings, selectedBookingId]);

  async function loadDashboard() {
    const payload = await httpRequest<DashboardPayload>("/admin/dashboard/summary");
    setDashboard(payload);
  }

  async function loadTrainers() {
    const payload = await httpRequest<{ data: TrainerOption[] }>("/admin/trainers");
    setTrainers((payload.data || []).filter((row) => row.is_active));
  }

  async function loadCalendarConfig() {
    const payload = await httpRequest<SettingsPayload>("/admin/settings");
    setCalendarConfig(payload.data?.profile?.business_hours || DEFAULT_CALENDAR_CONFIG);
  }

  async function loadBookings(from?: string | null, to?: string | null) {
    setCalendarLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (calendarTrainerFilter) params.set("trainer_id", calendarTrainerFilter);
      if (calendarStatusFilter !== "ALL") params.set("status", calendarStatusFilter);

      const payload = await httpRequest<{ data: AdminBookingItem[] }>(
        `/admin/bookings${params.toString() ? `?${params.toString()}` : ""}`
      );
      setBookings(payload.data || []);
    } finally {
      setCalendarLoading(false);
    }
  }

  async function refreshCalendar() {
    try {
      await Promise.all([loadCalendarConfig(), loadBookings(visibleRangeRef.current.from, visibleRangeRef.current.to)]);
      toast.success("Takvim yenilendi");
    } catch {
      toast.error("Takvim yenilenemedi");
    }
  }

  function handleDatesSet(info: { start: Date; end: Date; view: { title: string } }) {
    const from = info.start.toISOString();
    const to = info.end.toISOString();
    const rangeKey = `${from}|${to}`;

    if (lastDatesSetKeyRef.current === rangeKey) {
      setWeekLabel((prev) => (prev === info.view.title ? prev : info.view.title));
      return;
    }

    lastDatesSetKeyRef.current = rangeKey;
    visibleRangeRef.current = { from, to };
    setWeekLabel((prev) => (prev === info.view.title ? prev : info.view.title));
    loadBookings(from, to).catch(() => toast.error("Birleşik takvim verileri yüklenemedi"));
  }

  const effectiveWorkingDays = useMemo(() => normalizeWorkingDays(calendarConfig), [calendarConfig]);
  const startTime = calendarConfig.start_time || "09:00";
  const endTime = calendarConfig.end_time || "18:00";
  const lunchStart = calendarConfig.lunch_break_start || "12:00";
  const lunchEnd = calendarConfig.lunch_break_end || "13:00";
  const slotMinutes = Math.max(15, Math.min(180, Number(calendarConfig.slot_minutes || 60)));
  const bookingSlotDuration = slotDurationText(slotMinutes);
  const businessHours = useMemo(
    () => buildBusinessHours(startTime, endTime, lunchStart, lunchEnd, effectiveWorkingDays),
    [effectiveWorkingDays, endTime, lunchEnd, lunchStart, startTime]
  );

  const trainerMap = useMemo(
    () =>
      new Map(
        trainers.map((trainer) => [
          trainer.id,
          `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email,
        ])
      ),
    [trainers]
  );

  const trainerColorMap = useMemo(() => {
    const ids = Array.from(new Set(bookings.map((row) => row.trainer_id).filter(Boolean)));
    return new Map(ids.map((trainerId, index) => [trainerId, TRAINER_COLOR_PALETTE[index % TRAINER_COLOR_PALETTE.length]]));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = calendarMemberQuery.trim().toLocaleLowerCase("tr");
    if (!normalizedQuery) return bookings;

    return bookings.filter((row) =>
      [row.member_full_name, row.member_email, row.member_phone, row.member_id]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalizedQuery)
    );
  }, [bookings, calendarMemberQuery]);

  const selectedBooking = filteredBookings.find((row) => row.id === selectedBookingId) || bookings.find((row) => row.id === selectedBookingId) || null;

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      filteredBookings.map((row) => {
        const trainerLabel = row.trainer_full_name || trainerMap.get(row.trainer_id) || row.trainer_email || row.trainer_id;
        return {
          id: row.id,
          title: row.member_full_name || row.member_id,
          start: row.starts_at,
          end: row.ends_at,
          backgroundColor: trainerColorMap.get(row.trainer_id) || TRAINER_COLOR_PALETTE[0],
          borderColor: "transparent",
          className: ["interactive"],
          extendedProps: {
            trainerLabel,
          },
        };
      }),
    [filteredBookings, trainerColorMap, trainerMap]
  );

  function renderEventContent(arg: {
    event: { title: string; start: Date | null; end: Date | null; extendedProps: Record<string, unknown> };
  }) {
    const start = arg.event.start;
    const end = arg.event.end;
    const trainerLabel = compactPersonLabel(String(arg.event.extendedProps.trainerLabel || "Eğitmen belirtilmedi"));
    const timeLabel =
      start && end
        ? `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "Saat belirtilmedi";

    return (
      <div className="fc-event-content-modern">
        <p className="fc-event-title-modern">{arg.event.title}</p>
        <p className="fc-event-time-modern">{trainerLabel}</p>
        <p className="fc-event-time-modern">{timeLabel}</p>
      </div>
    );
  }

  function openBookingDetail(info: EventClickArg) {
    setSelectedBookingId(String(info.event.id));
  }

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }

  if (status === "unauthorized") return null;

  return (
    <AppShell>
      <PageHeader
        title="Klinik Yönetim Dashboard"
        description="Aktif ekip, üye yoğunluğu, risk durumu ve bugünkü operasyon özeti"
        actions={
          <ActionButton action="refresh" size="sm" onClick={refreshCalendar}>
            Takvimi Yenile
          </ActionButton>
        }
      />

      {!dashboard ? (
        <Card className="surface-card">
          <CardContent className="pt-6 text-sm text-muted-foreground">Veri yükleniyor...</CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Aktif Eğitmen" value={dashboard.kpis.active_trainers} tone="sky" icon={<Stethoscope className="h-3.5 w-3.5" />} hint="Bugün planı olan ekip" />
            <MetricCard label="Aktif Üye" value={dashboard.kpis.active_members} tone="emerald" icon={<Users className="h-3.5 w-3.5" />} hint="Aktif paketli üyeler" />
            <MetricCard label="Riskli Üye" value={dashboard.kpis.at_risk_members} tone="amber" icon={<ShieldAlert className="h-3.5 w-3.5" />} hint="Öncelikli aksiyon listesi" />
            <MetricCard label="Bugünkü Randevu" value={dashboard.kpis.todays_bookings} tone="sky" icon={<CalendarCheck2 className="h-3.5 w-3.5" />} hint="Takvim yoğunluğu" />
            <MetricCard label="Bugünkü Ders" value={dashboard.kpis.todays_sessions} tone="emerald" icon={<Activity className="h-3.5 w-3.5" />} hint="İşlenecek aktif seans" />
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <RevenueCard label="Günlük Kazanç" value={dashboard.revenue.daily} formatter={tryFormatter} icon={<Coins className="h-3.5 w-3.5" />} />
            <RevenueCard label="Haftalık Kazanç" value={dashboard.revenue.weekly} formatter={tryFormatter} icon={<Coins className="h-3.5 w-3.5" />} />
            <RevenueCard label="Aylık Kazanç" value={dashboard.revenue.monthly} formatter={tryFormatter} icon={<Coins className="h-3.5 w-3.5" />} />
            <RevenueCard label="Yıllık Kazanç" value={dashboard.revenue.yearly} formatter={tryFormatter} icon={<Coins className="h-3.5 w-3.5" />} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[2.15fr,0.85fr]">
            <div className="grid gap-4">
              <Card className="surface-card">
                <CardHeader>
                  <CardTitle>Takvim Filtreleri</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="filter-toolbar grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(320px,1.55fr)_minmax(220px,1fr)_220px_120px]">
                    <div className="grid gap-1.5">
                      <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">Üye Ara</label>
                      <div className="relative">
                        <AppIcon icon="fa-solid fa-user" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-10"
                          placeholder="Örn. Ayşe, 05xx, mail veya ID"
                          value={calendarMemberQuery}
                          onChange={(e) => setCalendarMemberQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">Eğitmen</label>
                      <div className="relative">
                        <AppIcon icon="fa-solid fa-user-tie" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
                        <Select className="appearance-none pl-10 pr-10" value={calendarTrainerFilter} onChange={(e) => setCalendarTrainerFilter(e.target.value)}>
                          <option value="">Tüm eğitmenler</option>
                          {trainers.map((trainer) => (
                            <option key={trainer.id} value={trainer.id}>
                              {formatPersonLabel(trainer)}
                            </option>
                          ))}
                        </Select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">Randevu Durumu</label>
                      <div className="relative">
                        <AppIcon icon="fa-solid fa-calendar-check" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
                        <Select className="appearance-none pl-10 pr-10" value={calendarStatusFilter} onChange={(e) => setCalendarStatusFilter(e.target.value as BookingStatusFilter)}>
                          <option value="ALL">Tümü</option>
                          <option value="PENDING">Onay Bekliyor</option>
                          <option value="APPROVED">Onaylandı</option>
                          <option value="RESCHEDULED">Yeniden Planlandı</option>
                          <option value="CANCELED">İptal Edildi</option>
                        </Select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <ActionButton action="refresh" variant="outline" className="h-10 w-full justify-center" onClick={refreshCalendar}>
                        Yenile
                      </ActionButton>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Ad, telefon, e-posta veya üye ID ile filtreleyin.</p>
                </CardContent>
              </Card>

              <AdminCombinedBookingCalendar
                calendarLoading={calendarLoading}
                weekLabel={weekLabel}
                startTime={startTime}
                endTime={endTime}
                slotMinutes={slotMinutes}
                slotDurationText={bookingSlotDuration}
                businessHours={businessHours}
                calendarEvents={calendarEvents}
                openBookingDetail={openBookingDetail}
                renderEventContent={renderEventContent}
                handleDatesSet={handleDatesSet}
              />
            </div>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Randevu Detayı</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {!selectedBooking ? (
                  <EmptyState
                    icon={<i className="fa-solid fa-circle-info" aria-hidden="true" />}
                    title="Takvimden bir randevu seçin"
                    description="Tıklanan booking'in üye, eğitmen, paket ve saat bilgisi burada açılır."
                  />
                ) : (
                  <>
                    <div className="section-band grid gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedBooking.member_full_name || selectedBooking.member_id}
                        </p>
                        <Badge variant="secondary">{bookingStatusLabel(selectedBooking.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Eğitmen: {selectedBooking.trainer_full_name || trainerMap.get(selectedBooking.trainer_id) || selectedBooking.trainer_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedBooking.starts_at).toLocaleString("tr-TR")} - {new Date(selectedBooking.ends_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <BookingDetailRow
                        icon={<Dumbbell className="h-4 w-4" />}
                        label="Ders Tipi"
                        value={selectedBooking.lesson_category_label || selectedBooking.lesson_category || "Ders belirtilmedi"}
                      />
                      <BookingDetailRow
                        icon={<PackageOpen className="h-4 w-4" />}
                        label="Paket"
                        value={selectedBooking.package_title || "Paket belirtilmedi"}
                      />
                      <BookingDetailRow
                        icon={<Mail className="h-4 w-4" />}
                        label="E-posta"
                        value={selectedBooking.member_email || "E-posta yok"}
                      />
                      <BookingDetailRow
                        icon={<Phone className="h-4 w-4" />}
                        label="Telefon"
                        value={selectedBooking.member_phone || "Telefon yok"}
                      />
                      <BookingDetailRow
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Durum"
                        value={bookingStatusLabel(selectedBooking.status)}
                      />
                      <BookingDetailRow
                        icon={<CalendarClock className="h-4 w-4" />}
                        label="Kayıt Zamanı"
                        value={`${new Date(selectedBooking.starts_at).toLocaleString("tr-TR")} - ${new Date(selectedBooking.ends_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                      />
                      {selectedBooking.session_title ? (
                        <BookingDetailRow
                          icon={<CalendarCheck2 className="h-4 w-4" />}
                          label="Bağlı Seans"
                          value={selectedBooking.session_title}
                        />
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Paket Satış Özeti</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <article className="rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-white p-4">
                <p className="text-xs text-muted-foreground">Bu Hafta Satılan Toplam Ders Hakkı</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.package_sales.weekly_credits_sold}</p>
              </article>
              <article className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white p-4">
                <p className="text-xs text-muted-foreground">Bu Ay Satılan Toplam Ders Hakkı</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.package_sales.monthly_credits_sold}</p>
              </article>
              <article className="rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-white p-4">
                <p className="text-xs text-muted-foreground">Haftalık 8 Ders Paket Satışı</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.package_sales.weekly_pack_8_count}</p>
              </article>
              <article className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white p-4">
                <p className="text-xs text-muted-foreground">Haftalık 4 Ders Paket Satışı</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.package_sales.weekly_pack_4_count}</p>
              </article>
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Aktif Eğitmen Listesi</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {dashboard.spotlight.trainers.length === 0 ? (
                  <EmptyState
                    icon={<i className="fa-solid fa-user-nurse" aria-hidden="true" />}
                    title="Aktif eğitmen bulunmuyor"
                    description="Eğitmenler burada hızlı erişim paneli gibi listelenir."
                  />
                ) : (
                  dashboard.spotlight.trainers.map((trainer) => (
                    <Link key={trainer.id} href={`/admin/trainers/${trainer.id}`} className="list-row interactive">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{`${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email}</p>
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-arrow-up-right-from-square" /></span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{trainer.email}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Aktif Üye Listesi</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {dashboard.spotlight.members.length === 0 ? (
                  <EmptyState
                    icon={<i className="fa-solid fa-users" aria-hidden="true" />}
                    title="Aktif üye bulunmuyor"
                    description="Üye yoğunluğu ve hızlı erişim burada görünür."
                  />
                ) : (
                  dashboard.spotlight.members.map((member) => (
                    <Link key={member.id} href={`/admin/members/${member.id}`} className="list-row interactive">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{`${member.first_name || ""} ${member.last_name || ""}`.trim() || member.email}</p>
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-arrow-up-right-from-square" /></span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{member.email}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Öncelikli Riskli Kullanıcılar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {dashboard.risk_preview.length === 0 ? (
                <EmptyState
                  icon={<i className="fa-solid fa-shield-heart" aria-hidden="true" />}
                  title="Risk sinyali bulunmuyor"
                  description="Yüksek öncelikli kullanıcı oluştuğunda bu panelde öne çıkarılır."
                />
              ) : (
                dashboard.risk_preview.map((item) => (
                  <article key={item.member_id} className={`list-row ${item.level === "HIGH" ? "status-accent-high" : item.level === "MEDIUM" ? "status-accent-medium" : "status-accent-low"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/members/${item.member_id}`} className="interactive font-semibold accent-text-link">
                        {item.full_name}
                      </Link>
                      <Badge variant="secondary">{riskLabel(item.level)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.reasons.join(" • ") || "Risk sinyali yok"}</p>
                    <p className="mt-2 text-xs text-slate-500">Risk skoru: {item.score}</p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function RevenueCard({
  label,
  value,
  formatter,
  icon,
}: {
  label: string;
  value: number;
  formatter: Intl.NumberFormat;
  icon?: ReactNode;
}) {
  return <MetricCard label={label} value={formatter.format(value || 0)} tone="slate" icon={icon} hint="Finansal performans özeti" />;
}
