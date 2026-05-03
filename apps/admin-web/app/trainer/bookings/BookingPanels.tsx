"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionButton } from "@/components/ui/action-button";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  CircleHelp,
  ClipboardList,
  Clock3,
  Dumbbell,
  PackageOpen,
  Search,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import type { BookingItem } from "./booking-types";
import { bookingStatusLabel, paymentStatusLabel } from "@/lib/presentation";

function formatTimeRange(startValue?: string, endValue?: string) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Saat belirtilmedi";
  return `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateTimeRange(startValue?: string, endValue?: string) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Tarih belirtilmedi";
  return `${start.toLocaleString("tr-TR")} - ${end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

function parseNoteLines(note?: string | null) {
  const parts = String(note || "")
    .split(/\s*\|\s*/)
    .flatMap((chunk) => chunk.split(/\s*[•·]\s*/))
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return parts.filter((part, index) => parts.indexOf(part) === index);
}

function compactMoney(value?: string | null) {
  if (!value) return "Belirlenecek";
  return `${value} TL`;
}

function lessonLabel(value?: string | null) {
  if (!value) return "Ders tipi belirlenecek";
  if (value === "GRUP") return "Grup";
  return value;
}

function DetailRow({
  icon,
  label,
  value,
  secondary,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="detail-pill w-full items-start gap-3 px-4 py-3">
      <span className="shrink-0 rounded-2xl bg-sky-50 p-2 text-sky-600">{icon}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span className="break-all text-sm font-medium text-slate-900">{value}</span>
        {secondary ? <span className="break-all text-xs text-muted-foreground">{secondary}</span> : null}
      </span>
    </div>
  );
}

export type SuggestionSlot = {
  id: string;
  member_id: string;
  starts_at: string;
  ends_at: string;
  note?: string;
  package_id?: string;
  package_title?: string;
  package_display_price?: string | null;
  lesson_category?: string | null;
  date_label: string;
  day_label: string;
  time_label: string;
  is_today: boolean;
  is_selected: boolean;
};

export type SuggestionPackageOption = {
  id: string;
  label: string;
  lesson_category?: string | null;
  display_price?: string | null;
};

export type SuggestionGroup = {
  id: string;
  member_id: string;
  member_full_name: string;
  member_email?: string | null;
  weekly_target: number;
  existing_count: number;
  remaining_count: number;
  slot_count: number;
  selected_count: number;
  selected_package_id: string;
  package_options: SuggestionPackageOption[];
  package_titles: string[];
  lesson_labels: string[];
  blocker_text?: string | null;
  slots: SuggestionSlot[];
};

export type RescheduleOption = {
  id: string;
  starts_at: string;
  ends_at: string;
  date_label: string;
  time_label: string;
  day_label: string;
  note?: string;
};

export function BookingOverviewCard({
  startTime,
  endTime,
  lunchStart,
  lunchEnd,
  slotMinutes,
}: {
  startTime: string;
  endTime: string;
  lunchStart: string;
  lunchEnd: string;
  slotMinutes: number;
}) {
  return (
    <Card className="surface-card">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.25fr,0.95fr]">
        <div className="section-band">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Yeni Planlama Akışı</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <UserRound className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-900">1. Uygun slotları gör</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Sistem yalnızca danışanın tercihleri, paket yetkisi ve çalışma saatleriyle uyumlu slotları listeler.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CalendarRange className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-900">2. Haftalık hakkı kadar seç</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Eğitmen kalan haftalık ders hakkı kadar slot seçer; fazlası otomatik engellenir.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ClipboardList className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-900">3. Takvime aktar</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Seçilen slotlar doğrudan booking olur. Sonradan tarih değişecekse booking detayı içinden yeniden planlanır.
              </p>
            </div>
          </div>
        </div>

        <div className="section-band">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Takvim Kuralları</p>
          <div className="mt-4 grid gap-2">
            <div className="detail-pill">
              <CalendarDays className="h-4 w-4 text-sky-600" />
              <span>Çalışma saati: {startTime} - {endTime}</span>
            </div>
            <div className="detail-pill">
              <CircleHelp className="h-4 w-4 text-sky-600" />
              <span>Öğle arası: {lunchStart} - {lunchEnd}</span>
            </div>
            <div className="detail-pill">
              <Clock3 className="h-4 w-4 text-sky-600" />
              <span>Slot aralığı: {slotMinutes} dakika</span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Son 3 saat içindeki booking yeniden planlamaya açılmaz. Uygun yeni slotlar yalnızca aynı haftadaki gerçek müsaitliklerden üretilir.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function BookingSupportPanel({
  planningMemberQuery,
  setPlanningMemberQuery,
  visibleMemberCount,
  visibleSlotCount,
  activeBookingCount,
  remainingPlacementCount,
  weekLabel,
}: {
  planningMemberQuery: string;
  setPlanningMemberQuery: (value: string) => void;
  visibleMemberCount: number;
  visibleSlotCount: number;
  activeBookingCount: number;
  remainingPlacementCount: number;
  weekLabel: string;
}) {
  return (
    <div className="grid gap-4">
      <Card className="surface-card xl:sticky xl:top-24">
        <CardHeader className="pb-3">
          <CardTitle>Planlama Paneli</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="Danışan Ara" hint="Ad, e-posta, not veya danışan ID ile filtreleyin.">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Danışan veya not ara"
                value={planningMemberQuery}
                onChange={(event) => setPlanningMemberQuery(event.target.value)}
              />
            </div>
          </FormField>

          <div className="section-band grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hafta</span>
              <span className="text-sm font-medium text-slate-900">{weekLabel || "Yükleniyor"}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className="detail-pill justify-between">
                <span>Görünür danışan</span>
                <strong>{visibleMemberCount}</strong>
              </div>
              <div className="detail-pill justify-between">
                <span>Uygun slot</span>
                <strong>{visibleSlotCount}</strong>
              </div>
              <div className="detail-pill justify-between">
                <span>Aktif booking</span>
                <strong>{activeBookingCount}</strong>
              </div>
              <div className="detail-pill justify-between">
                <span>Kalan yerleştirme</span>
                <strong>{remainingPlacementCount}</strong>
              </div>
            </div>
          </div>

          <div className="section-band">
            <p className="text-sm font-medium text-slate-900">Nasıl çalışır?</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Her danışan kartında uygun slotlar ayrı ayrı görünür. Slotları işaretleyip doğrudan takvime aktarın; mevcut booking üzerinde tarih değişikliği için detay penceresinden yeniden planla kullanın.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BookingSuggestionsBoard({
  groups,
  availabilityLoading,
  busy,
  onToggleSlot,
  onSelectRecommended,
  onClearSelection,
  onScheduleGroup,
  onPackageChange,
}: {
  groups: SuggestionGroup[];
  availabilityLoading: boolean;
  busy: boolean;
  onToggleSlot: (groupId: string, slotId: string) => void;
  onSelectRecommended: (groupId: string) => void;
  onClearSelection: (groupId: string) => void;
  onScheduleGroup: (groupId: string) => void;
  onPackageChange: (groupId: string, packageId: string) => void;
}) {
  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>Uygun Ders Önerileri</CardTitle>
      </CardHeader>
      <CardContent>
        {availabilityLoading ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-52 rounded-3xl bg-slate-100" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-calendar-plus" aria-hidden="true" />}
            title="Bu hafta uygun slot görünmüyor"
            description="Aramayı temizleyin veya üyelerin haftalık müsaitlik girişlerini kontrol edin."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => {
              const hasBlocker = !!group.blocker_text;
              const canSelect = group.remaining_count > 0 && !hasBlocker;

              return (
                <article key={group.id} className="rounded-[calc(var(--ui-radius-lg)+4px)] border border-slate-200 bg-white p-4 shadow-[var(--ui-shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/trainer/members?memberId=${group.member_id}`} className="interactive block truncate text-base font-semibold text-slate-950 hover:text-sky-700">
                        {group.member_full_name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{group.member_email || "E-posta bilgisi yok"}</p>
                    </div>
                    <Badge variant="secondary" className="border-slate-200 bg-slate-50 text-slate-700">
                      {group.slot_count} uygun slot
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Haftalık hedef</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{group.weekly_target} ders</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mevcut booking</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{group.existing_count}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kalan seçim hakkı</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{group.remaining_count}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {group.lesson_labels.map((label) => (
                      <span key={`${group.id}-lesson-${label}`} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                        {lessonLabel(label)}
                      </span>
                    ))}
                    {group.package_titles.map((title) => (
                      <span key={`${group.id}-package-${title}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                        {title}
                      </span>
                    ))}
                  </div>

                  {group.package_options.length > 1 && group.slots.some((slot) => !slot.package_id) ? (
                    <div className="mt-4">
                      <FormField label="Varsayılan Paket" hint="Paket bilgisi eksik slotlarda bu seçim kullanılacak.">
                        <Select value={group.selected_package_id} onChange={(event) => onPackageChange(group.id, event.target.value)}>
                          <option value="">Paket seçin</option>
                          {group.package_options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                              {option.display_price ? ` - ${option.display_price} TL` : ""}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>
                  ) : null}

                  {hasBlocker ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {group.blocker_text}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    {group.slots.map((slot) => {
                      const isSelected = slot.is_selected;
                      const noteLines = parseNoteLines(slot.note);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => onToggleSlot(group.id, slot.id)}
                          disabled={!canSelect}
                          className={`interactive rounded-2xl border px-3 py-3 text-left transition ${
                            !canSelect
                              ? "cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-70"
                              : "border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                                  {slot.day_label}
                                </span>
                                {slot.is_today ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                                    Bugün
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{slot.time_label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{slot.date_label}</p>
                            </div>
                            <span
                              className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                                isSelected
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500"
                              }`}
                            >
                              {isSelected ? "✓" : "+"}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-1.5 text-[12px]">
                            <p className="rounded-xl bg-white/85 px-2.5 py-1.5 text-slate-700">
                              <strong className="text-slate-900">Ders:</strong> {lessonLabel(slot.lesson_category)}
                            </p>
                            <p className="rounded-xl bg-white/85 px-2.5 py-1.5 text-slate-700">
                              <strong className="text-slate-900">Paket:</strong> {slot.package_title || "Paket seçilecek"}
                            </p>
                            <p className="rounded-xl bg-white/85 px-2.5 py-1.5 text-slate-700">
                              <strong className="text-slate-900">Ücret:</strong> {compactMoney(slot.package_display_price)}
                            </p>
                            {noteLines.length ? (
                              <div className="rounded-xl bg-white/85 px-2.5 py-1.5 text-slate-700">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Not</p>
                                <p className="break-words">{noteLines[0]}</p>
                                {noteLines.length > 1 ? <p className="mt-1 text-[10px] text-slate-500">+{noteLines.length - 1} satır daha</p> : null}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectRecommended(group.id)}
                        disabled={!canSelect || group.remaining_count === 0}
                      >
                        İlk {group.remaining_count} slotu seç
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onClearSelection(group.id)}
                        disabled={group.selected_count === 0}
                      >
                        Seçimi Temizle
                      </Button>
                    </div>
                    <ActionButton
                      action="create"
                      size="sm"
                      onClick={() => onScheduleGroup(group.id)}
                      disabled={busy || group.selected_count === 0 || !canSelect}
                    >
                      {busy ? "Aktarılıyor..." : "Takvime Aktar"}
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BookingDetailDialog({
  isOpen,
  onClose,
  selectedBooking,
  canReschedule,
  rescheduleHint,
  onOpenReschedule,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedBooking: BookingItem | null;
  canReschedule: boolean;
  rescheduleHint?: string;
  onOpenReschedule: () => void;
}) {
  if (!isOpen || !selectedBooking) return null;

  const noteLines = parseNoteLines(typeof selectedBooking.meta?.note === "string" ? selectedBooking.meta.note : "");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Randevu Detayı</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link
                href={`/trainer/members?memberId=${selectedBooking.member_id}`}
                className="interactive font-medium hover:text-sky-700"
                onClick={onClose}
              >
                {selectedBooking.member_full_name || selectedBooking.member_id}
              </Link>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Detay penceresini kapat">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid gap-3 text-sm">
          <div className="section-band grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{selectedBooking.member_full_name || selectedBooking.member_id}</p>
              <Badge variant="secondary">{bookingStatusLabel(selectedBooking.status)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTimeRange(selectedBooking.starts_at, selectedBooking.ends_at)}</p>
          </div>

          <DetailRow
            icon={<ClipboardList className="h-4 w-4" />}
            label="Durum"
            value={bookingStatusLabel(selectedBooking.status)}
          />
          <DetailRow
            icon={<CalendarClock className="h-4 w-4" />}
            label="Tarih ve Saat"
            value={formatDateTimeRange(selectedBooking.starts_at, selectedBooking.ends_at)}
          />
          <DetailRow
            icon={<Dumbbell className="h-4 w-4" />}
            label="Ders"
            value={selectedBooking.session_title || selectedBooking.lesson_category || "Belirtilmedi"}
          />
          <DetailRow
            icon={<PackageOpen className="h-4 w-4" />}
            label="Paket"
            value={selectedBooking.package_title || "Belirtilmedi"}
            secondary={`Ücret: ${compactMoney(selectedBooking.package_display_price)}`}
          />
          <DetailRow
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Ödeme"
            value={paymentStatusLabel(selectedBooking.payment_status)}
          />
          {noteLines.length ? (
            <div className="detail-pill w-full items-start gap-3 px-4 py-3">
              <span className="shrink-0 rounded-2xl bg-sky-50 p-2 text-sky-600">
                <StickyNote className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Not</span>
                {noteLines.map((line, index) => (
                  <span key={`${selectedBooking.id}-note-${index}`} className="break-words text-sm font-medium text-slate-900">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <ActionButton action="cancel" type="button" onClick={onClose}>
            Kapat
          </ActionButton>
          <ActionButton action="edit" type="button" onClick={onOpenReschedule} disabled={!canReschedule}>
            Yeniden Planla
          </ActionButton>
        </div>
        {!canReschedule && rescheduleHint ? <p className="mt-3 text-xs text-amber-700">{rescheduleHint}</p> : null}
      </div>
    </div>
  );
}

export function BookingRescheduleDialog({
  isOpen,
  onClose,
  selectedBooking,
  options,
  selectedOptionId,
  setSelectedOptionId,
  onSubmit,
  busy,
  blockedReason,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedBooking: BookingItem | null;
  options: RescheduleOption[];
  selectedOptionId: string;
  setSelectedOptionId: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  blockedReason?: string;
}) {
  if (!isOpen || !selectedBooking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Randevuyu Yeniden Planla</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedBooking.member_full_name || selectedBooking.member_id} için yeni uygun slot seçin.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Yeniden planlama penceresini kapat">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="section-band mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mevcut Booking</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTimeRange(selectedBooking.starts_at, selectedBooking.ends_at)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedBooking.package_title || selectedBooking.lesson_category || "Ders tipi belirtilmedi"}
          </p>
        </div>

        {blockedReason ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {blockedReason}
          </div>
        ) : options.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-calendar-xmark" aria-hidden="true" />}
            title="Uygun alternatif slot bulunamadı"
            description="Bu hafta içinde çakışmasız ve kurallara uygun başka bir slot görünmüyor."
          />
        ) : (
          <div className="grid gap-3">
            {options.map((option) => {
              const noteLines = parseNoteLines(option.note);
              const isSelected = selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`interactive rounded-2xl border px-4 py-3 text-left ${
                    isSelected ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{option.time_label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {option.day_label} • {option.date_label}
                      </p>
                    </div>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${isSelected ? "border-sky-400 bg-sky-600 text-white" : "border-slate-300 text-slate-500"}`}>
                      {isSelected ? "✓" : ""}
                    </span>
                  </div>
                  {noteLines.length ? <p className="mt-2 text-xs text-slate-600">{noteLines[0]}</p> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <ActionButton action="cancel" type="button" onClick={onClose}>
            Vazgeç
          </ActionButton>
          <ActionButton action="edit" type="button" onClick={onSubmit} disabled={busy || !selectedOptionId || !!blockedReason}>
            {busy ? "Taşınıyor..." : "Yeni Slota Taşı"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
