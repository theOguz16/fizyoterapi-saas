"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { attendanceResultLabel } from "@/lib/presentation";
import { httpRequest } from "@/lib/http-client";
import { cn } from "@/lib/utils";
import type { TrainerMeasurementTrendRow } from "./TrainerMemberMeasurementTrend";

const TrainerMemberMeasurementTrend = dynamic(
  () => import("./TrainerMemberMeasurementTrend").then((mod) => mod.TrainerMemberMeasurementTrend),
  {
    ssr: false,
    loading: () => <div className="h-[320px] w-full animate-pulse rounded-[var(--ui-radius-md)] bg-slate-100/80" />,
  }
);

type MemberRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  qr_code?: string | null;
};

type MemberDetail = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  qr_code?: string | null;
  stats: {
    booking_count: number;
    checkin_count: number;
    latest_measured_at: string | null;
  };
  package_summary?: Array<{
    user_package_id: string;
    package_id: string;
    package_title?: string | null;
    package_type?: string | null;
    package_total_credits?: number | null;
    package_duration_days?: number | null;
    package_price?: number | null;
    package_rules?: Record<string, unknown> | null;
    remaining_credits: number;
    is_active: boolean;
    starts_at?: string | null;
    expires_at?: string | null;
    is_expired?: boolean;
    trainer_summary?: string | null;
    assigned_trainers?: Array<{
      id: string;
      full_name: string;
      email: string;
    }>;
  }>;
  campaign_rewards?: Array<{
    id: string;
    credits_granted: number;
    rule_name: string;
    granted_at: string;
  }>;
  attendance_trend?: Array<{
    week_start: string;
    count: number;
  }>;
};

type AttendanceRow = {
  id: string;
  created_at: string;
  result: string;
  credits_deducted: number;
  session_title?: string | null;
  lesson_category?: string | null;
};

type MeasurementRow = {
  id: string;
  measured_at: string;
  height_cm: string | null;
  weight_kg: string | null;
  fat_percent: string | null;
  muscle_kg: string | null;
};

type NoteHistoryRow = {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
};

type CoachNoteTag = "GENERAL" | "GOAL" | "RISK" | "FOLLOW_UP";

type MemberNotesPayload = {
  data: {
    member_id: string;
    note: string;
    updated_at: string | null;
    items: NoteHistoryRow[];
    count: number;
  };
};

type PackageSummaryRow = NonNullable<MemberDetail["package_summary"]>[number];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Yok";
  return new Date(value).toLocaleString("tr-TR");
}

function formatMetricValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

function formatUnitValue(value: string | number | null | undefined, unit: string, prefix = false) {
  const formatted = formatMetricValue(value);
  if (formatted === "-") return "-";
  return prefix ? `${unit}${formatted}` : `${formatted} ${unit}`;
}

function extractLessonLabel(pkg: PackageSummaryRow) {
  const rules = pkg.package_rules || {};
  const serviceName = typeof rules.service_name === "string" ? rules.service_name : "";
  const lessonCategory = typeof rules.lesson_category === "string" ? rules.lesson_category : "";
  const serviceKey = typeof rules.service_key === "string" ? rules.service_key : "";
  return serviceName || lessonCategory || serviceKey || pkg.package_type || "Belirlenmedi";
}

function truncateNote(note: string) {
  const trimmed = note.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 88) return trimmed;
  return `${trimmed.slice(0, 88)}...`;
}

const COACH_NOTE_TAG_OPTIONS: Array<{ value: CoachNoteTag; label: string }> = [
  { value: "GENERAL", label: "Genel" },
  { value: "GOAL", label: "Hedef" },
  { value: "RISK", label: "Risk" },
  { value: "FOLLOW_UP", label: "Takip" },
];

function coachNoteTagLabel(tag: CoachNoteTag) {
  return COACH_NOTE_TAG_OPTIONS.find((item) => item.value === tag)?.label || "Genel";
}

function coachNoteTagTone(tag: CoachNoteTag) {
  if (tag === "RISK") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tag === "GOAL") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tag === "FOLLOW_UP") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function serializeCoachNote(tag: CoachNoteTag, value: string) {
  const body = value.trim();
  if (!body) return "";
  return `[#TAG:${tag}] ${body}`;
}

function parseCoachNote(raw?: string | null) {
  const normalized = String(raw || "").trim();
  const match = normalized.match(/^\[#TAG:(GENERAL|GOAL|RISK|FOLLOW_UP)\]\s*/);
  if (!match) {
    return {
      tag: "GENERAL" as CoachNoteTag,
      body: normalized,
    };
  }

  return {
    tag: match[1] as CoachNoteTag,
    body: normalized.slice(match[0].length).trim(),
  };
}

export default function TrainerMembersPage() {
  const searchParams = useSearchParams();
  const { loading: authLoading, user } = useRequireRole("TRAINER");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [busy, setBusy] = useState(false);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [note, setNote] = useState("");
  const [noteTag, setNoteTag] = useState<CoachNoteTag>("GENERAL");
  const [noteFilterTag, setNoteFilterTag] = useState<CoachNoteTag | "ALL">("ALL");
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [noteHistory, setNoteHistory] = useState<NoteHistoryRow[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const membersListAbortRef = useRef<AbortController | null>(null);
  const membersListRequestIdRef = useRef(0);
  const detailAbortRef = useRef<AbortController | null>(null);
  const detailRequestIdRef = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    loadMembers().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Danışan listesi yüklenemedi");
    });
  }, [status]);

  useEffect(() => {
    const fromQuery = searchParams.get("memberId");
    if (fromQuery) {
      setSelectedMemberId(fromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedMemberId || status !== "ready") return;
    loadMemberDetail(selectedMemberId).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Danışan detayı yüklenemedi");
    });
  }, [selectedMemberId, status]);

  useEffect(() => {
    return () => {
      membersListAbortRef.current?.abort();
      detailAbortRef.current?.abort();
    };
  }, []);

  async function loadMembers() {
    membersListAbortRef.current?.abort();
    const controller = new AbortController();
    membersListAbortRef.current = controller;
    const requestId = ++membersListRequestIdRef.current;
    const payload = await httpRequest<{ data: MemberRow[] }>("/trainer/members", { signal: controller.signal });
    if (requestId !== membersListRequestIdRef.current) return;
    setMembers(payload.data || []);
  }

  async function loadMemberDetail(memberId: string) {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const requestId = ++detailRequestIdRef.current;
    setBusy(true);
    try {
      const [detailPayload, attendancePayload, measurementPayload, notePayload] = await Promise.all([
        httpRequest<{ data: MemberDetail }>(`/trainer/members/${memberId}`, { signal: controller.signal }),
        httpRequest<{ data: AttendanceRow[] }>(`/trainer/members/${memberId}/attendance?limit=20`, { signal: controller.signal }),
        httpRequest<{ data: MeasurementRow[] }>(`/trainer/members/${memberId}/measurements?limit=20`, { signal: controller.signal }),
        httpRequest<MemberNotesPayload>(`/trainer/members/${memberId}/notes`, { signal: controller.signal }),
      ]);

      if (requestId !== detailRequestIdRef.current) return;
      const historyRows = notePayload.data?.items || [];
      setDetail(detailPayload.data);
      setAttendance(attendancePayload.data || []);
      setMeasurements(measurementPayload.data || []);
      setNote("");
      setNoteTag("GENERAL");
      setNoteUpdatedAt(notePayload.data?.updated_at || null);
      setNoteHistory(historyRows);
      setSelectedHistoryId("");
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setBusy(false);
      }
    }
  }

  async function refreshNotes(memberId: string, selectedNoteId?: string | null) {
    const payload = await httpRequest<MemberNotesPayload>(`/trainer/members/${memberId}/notes`);
    const items = payload.data?.items || [];
    setNoteHistory(items);

    if (selectedNoteId) {
      const selected = items.find((item) => item.id === selectedNoteId) || null;
      const parsed = parseCoachNote(selected?.note);
      setSelectedHistoryId(selected?.id || "");
      setNote(parsed.body || "");
      setNoteTag(parsed.tag);
      setNoteUpdatedAt(selected?.updated_at || payload.data?.updated_at || null);
      return;
    }

    setSelectedHistoryId("");
    setNote("");
    setNoteTag("GENERAL");
    setNoteUpdatedAt(payload.data?.updated_at || null);
  }

  function selectNoteForEditing(item: NoteHistoryRow) {
    const parsed = parseCoachNote(item.note);
    setSelectedHistoryId(item.id);
    setNote(parsed.body);
    setNoteTag(parsed.tag);
    setNoteUpdatedAt(item.updated_at || item.created_at);
  }

  function resetNoteComposer() {
    setSelectedHistoryId("");
    setNote("");
    setNoteTag("GENERAL");
    setNoteUpdatedAt(noteHistory[0]?.updated_at || null);
  }

  async function createNote() {
    if (!selectedMemberId) return;
    if (!note.trim()) {
      toast.error("Önce not metni girin");
      return;
    }
    try {
      setBusy(true);
      await httpRequest(`/trainer/members/${selectedMemberId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: serializeCoachNote(noteTag, note) }),
      });
      await refreshNotes(selectedMemberId);
      toast.success("Yeni not eklendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Danışan notu eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function updateSelectedNote() {
    if (!selectedMemberId || !selectedHistoryId) return;
    if (!note.trim()) {
      toast.error("Önce not metni girin");
      return;
    }
    try {
      setBusy(true);
      await httpRequest(`/trainer/members/${selectedMemberId}/notes/${selectedHistoryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: serializeCoachNote(noteTag, note) }),
      });
      await refreshNotes(selectedMemberId, selectedHistoryId);
      toast.success("Not güncellendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Not güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedNote() {
    if (!selectedMemberId || !selectedHistoryId) return;
    try {
      setBusy(true);
      await httpRequest(`/trainer/members/${selectedMemberId}/notes/${selectedHistoryId}`, {
        method: "DELETE",
      });
      await refreshNotes(selectedMemberId);
      toast.success("Not silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Not silinemedi");
    } finally {
      setBusy(false);
    }
  }

  const filteredMembers = members.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return (
      row.full_name.toLowerCase().includes(normalizedQuery) ||
      row.email.toLowerCase().includes(normalizedQuery) ||
      row.phone.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredNoteHistory = useMemo(() => {
    if (noteFilterTag === "ALL") return noteHistory;
    return noteHistory.filter((item) => parseCoachNote(item.note).tag === noteFilterTag);
  }, [noteFilterTag, noteHistory]);

  const selectedHistoryNote = noteHistory.find((item) => item.id === selectedHistoryId) || null;
  const activePackageCount = (detail?.package_summary || []).filter((pkg) => pkg.is_active && !pkg.is_expired).length;
  const totalRemainingCredits = (detail?.package_summary || []).reduce((sum, pkg) => sum + Number(pkg.remaining_credits || 0), 0);
  const latestMeasurement = measurements[0] || null;
  const measurementTrendRows = useMemo<TrainerMeasurementTrendRow[]>(
    () =>
      [...measurements]
        .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
        .map((row) => ({
          dateText: new Date(row.measured_at).toLocaleDateString("tr-TR"),
          height_cm: row.height_cm ? Number(row.height_cm) : null,
          weight_kg: row.weight_kg ? Number(row.weight_kg) : null,
          fat_percent: row.fat_percent ? Number(row.fat_percent) : null,
          muscle_kg: row.muscle_kg ? Number(row.muscle_kg) : null,
        })),
    [measurements]
  );

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
        title="Danışan Yönetimi"
        description="Danışan listesi, paket geçmişi, ölçüm trendi ve koç notlarını tek merkezden yönetin."
        actions={
          <ActionButton action="refresh" size="sm" onClick={() => loadMembers().catch(() => toast.error("Danışan listesi yenilenemedi"))}>
            Listeyi Yenile
          </ActionButton>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[340px,1fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Danışanlarım</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label="Danışan Ara">
              <Input placeholder="Ad, e-posta veya telefon ara" value={query} onChange={(e) => setQuery(e.target.value)} />
            </FormField>
            <div className="subtle-scroll grid max-h-[70vh] gap-2 overflow-auto">
              {filteredMembers.length === 0 ? (
                <EmptyState
                  icon={<i className="fa-solid fa-users-viewfinder" aria-hidden="true" />}
                  title="Danışan bulunamadı"
                  description="Arama kriterinizi değiştirin veya yeni atanan üyeleri kontrol edin."
                />
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="interactive list-row text-left"
                    data-state={member.id === selectedMemberId ? "selected" : undefined}
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{member.full_name}</p>
                      <Badge variant={member.is_active ? "success" : "outline"}>{member.is_active ? "Aktif" : "Donduruldu"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {!detail ? (
            <Card className="surface-card">
              <CardContent className="pt-6">
                <EmptyState
                  icon={<i className="fa-solid fa-address-card" aria-hidden="true" />}
                  title="Danışan seçilmedi"
                  description="Soldaki listeden bir üye seçerek paket geçmişi, trend ve koç notlarını açabilirsiniz."
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Aktif Paket"
                  value={activePackageCount}
                  tone="sky"
                  hint="Şu anda kullanılabilir paketler"
                  icon={<i className="fa-solid fa-box-open" aria-hidden="true" />}
                />
                <MetricCard
                  label="Toplam Kalan Hak"
                  value={totalRemainingCredits}
                  tone="amber"
                  hint="Üyenin tüm paketlerinden kalan toplam kredi"
                  icon={<i className="fa-solid fa-ticket" aria-hidden="true" />}
                />
                <MetricCard
                  label="Son Katılım"
                  value={attendance[0]?.created_at ? formatDate(attendance[0].created_at) : "-"}
                  tone="emerald"
                  hint="En son check-in veya ders katılımı"
                  icon={<i className="fa-solid fa-calendar-check" aria-hidden="true" />}
                />
                <MetricCard
                  label="Kampanya Ödülü"
                  value={(detail.campaign_rewards || []).length}
                  tone="slate"
                  hint="Toplam referans ve sadakat hakedişi"
                  icon={<i className="fa-solid fa-gift" aria-hidden="true" />}
                />
              </section>

              <Card className="surface-card overflow-hidden">
                <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr),320px]">
                  <div className="grid gap-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Danışan Özeti</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{detail.full_name}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                          Eğitmen panelinden danışanın aktiflik durumu, kimlik bilgileri, son ölçüm tarihi ve paket ritmini tek blokta izleyin.
                        </p>
                      </div>
                      <Badge variant={detail.is_active ? "success" : "outline"}>{detail.is_active ? "Aktif" : "Donduruldu"}</Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="detail-pill min-h-[78px] items-start gap-3 px-4 py-3">
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-envelope" /></span>
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">E-posta</span>
                          <span className="text-sm font-medium text-slate-900">{detail.email}</span>
                        </span>
                      </div>
                      <div className="detail-pill min-h-[78px] items-start gap-3 px-4 py-3">
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-phone-volume" /></span>
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Telefon</span>
                          <span className="text-sm font-medium text-slate-900">{detail.phone}</span>
                        </span>
                      </div>
                      <div className="detail-pill min-h-[78px] items-start gap-3 px-4 py-3">
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-qrcode" /></span>
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">QR</span>
                          <span className="text-sm font-medium text-slate-900">{detail.qr_code || "Tanımlanmadı"}</span>
                        </span>
                      </div>
                      <div className="detail-pill min-h-[78px] items-start gap-3 px-4 py-3">
                        <span className="fa-chip"><AppIcon icon="fa-solid fa-ruler-combined" /></span>
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Son Ölçüm</span>
                          <span className="text-sm font-medium text-slate-900">{formatDateTime(detail.stats.latest_measured_at)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[var(--ui-radius-lg)] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,0.95))] p-4 shadow-[var(--ui-shadow-soft)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Canlı Sağlık Özeti</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <article className="rounded-[var(--ui-radius-md)] border border-sky-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <AppIcon icon="fa-solid fa-ruler-vertical" className="text-base" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Boy</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatUnitValue(latestMeasurement?.height_cm, "cm")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Son kayıtlı ölçüm</p>
                      </article>
                      <article className="rounded-[var(--ui-radius-md)] border border-emerald-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <AppIcon icon="fa-solid fa-weight-scale" className="text-base" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kilo</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatUnitValue(latestMeasurement?.weight_kg, "kg")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Güncel vücut ağırlığı</p>
                      </article>
                      <article className="rounded-[var(--ui-radius-md)] border border-amber-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                          <AppIcon icon="fa-solid fa-droplet" className="text-base" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Yağ</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatUnitValue(latestMeasurement?.fat_percent, "%", true)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Tahmini yağ oranı</p>
                      </article>
                      <article className="rounded-[var(--ui-radius-md)] border border-indigo-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                          <AppIcon icon="fa-solid fa-dumbbell" className="text-base" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kas</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatUnitValue(latestMeasurement?.muscle_kg, "kg")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ölçülen kas kütlesi</p>
                      </article>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Paket Geçmişi</CardTitle>
                  </CardHeader>
                  <CardContent className="subtle-scroll panel-scroll grid gap-3">
                    {(detail.package_summary || []).length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-box-open" aria-hidden="true" />}
                        title="Paket kaydı bulunmuyor"
                        description="Üye paketleri tanımlandığında burada ders, kalan hak ve atama bilgisi görünür."
                      />
                    ) : (
                      (detail.package_summary || []).map((pkg) => (
                        <article key={pkg.user_package_id} className="rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{pkg.package_title || pkg.package_id}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                {extractLessonLabel(pkg)} {pkg.package_type ? `• ${pkg.package_type}` : ""}
                              </p>
                            </div>
                            <Badge variant={pkg.is_active && !pkg.is_expired ? "success" : "outline"}>
                              {pkg.is_active && !pkg.is_expired ? "Aktif" : "Donduruldu"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            <div className="detail-pill justify-between px-4 py-3">
                              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <AppIcon icon="fa-solid fa-ticket" className="text-sky-600" />
                                Kalan Hak
                              </span>
                              <strong>{pkg.remaining_credits}</strong>
                            </div>
                            <div className="detail-pill justify-between px-4 py-3">
                              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <AppIcon icon="fa-solid fa-money-bill" className="text-emerald-600" />
                                Paket Bedeli
                              </span>
                              <strong>{pkg.package_price ? `₺${pkg.package_price.toLocaleString("tr-TR")}` : "Belirlenmedi"}</strong>
                            </div>
                            <div className="detail-pill justify-between px-4 py-3">
                              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <AppIcon icon="fa-solid fa-calendar-days" className="text-slate-600" />
                                Süre
                              </span>
                              <strong>{pkg.package_duration_days ? `${pkg.package_duration_days} gün` : "Süresiz"}</strong>
                            </div>
                            <div className="detail-pill justify-between px-4 py-3">
                              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <AppIcon icon="fa-solid fa-layer-group" className="text-orange-500" />
                                Toplam Hak
                              </span>
                              <strong>{pkg.package_total_credits ?? "-"}</strong>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                            <p>Başlangıç: {formatDate(pkg.starts_at)} • Bitiş: {formatDate(pkg.expires_at)}</p>
                            <p>Eğitmen: {pkg.trainer_summary || "Henüz eğitmen ataması görünmüyor"}</p>
                          </div>
                        </article>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Kampanya Hakedişleri</CardTitle>
                  </CardHeader>
                  <CardContent className="subtle-scroll panel-scroll grid gap-2">
                    {(detail.campaign_rewards || []).length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-gift" aria-hidden="true" />}
                        title="Hakediş kaydı bulunmuyor"
                        description="Referans ve sadakat ödülleri burada toplanır."
                      />
                    ) : (
                      (detail.campaign_rewards || []).map((reward) => (
                        <article key={reward.id} className="list-row text-sm">
                          <p className="font-medium">{reward.rule_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            +{reward.credits_granted} kredi • {formatDateTime(reward.granted_at)}
                          </p>
                        </article>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              <Card className="surface-card">
                <CardHeader className="pb-2">
                  <CardTitle>Koç Notları</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr),320px]">
                  <div className="grid gap-1 [&_.ui-field-hint]:leading-5 [&_.ui-field-meta]:mt-0 [&_.ui-field-meta]:min-h-0">
                    <FormField
                      label={selectedHistoryNote ? "Notu Düzenle" : "Yeni Not"}
                      className="gap-1"
                      hint={
                        selectedHistoryNote
                          ? `Seçili notu güncelleyebilir veya silebilirsiniz.${noteUpdatedAt ? ` Son güncelleme: ${formatDateTime(noteUpdatedAt)}.` : ""}`
                          : `Danışan için yeni hedef, risk veya takip notu ekleyin.${noteUpdatedAt ? ` Son kayıt: ${formatDateTime(noteUpdatedAt)}.` : ""}`
                      }
                    >
                      <div className="mb-2 grid gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Not Türü</label>
                        <div className="flex flex-wrap gap-2">
                          {COACH_NOTE_TAG_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setNoteTag(option.value)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                noteTag === option.value
                                  ? "border-sky-500 bg-sky-600 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Danışanın hedefleri, kritik notlar ve takip aksiyonları..."
                        className="h-40 resize-none overflow-y-auto"
                      />
                    </FormField>
                    <div className="-mt-1 flex flex-wrap gap-2">
                      <ActionButton
                        action="save"
                        className="self-start"
                        disabled={busy || !note.trim()}
                        onClick={selectedHistoryNote ? updateSelectedNote : createNote}
                      >
                        {selectedHistoryNote ? "Güncelle" : "Not Ekle"}
                      </ActionButton>
                      {selectedHistoryNote ? (
                        <>
                          <Button type="button" variant="outline" className="self-start" onClick={resetNoteComposer}>
                            Yeni Not
                          </Button>
                          <Button type="button" variant="outline" className="self-start border-rose-200 text-rose-700 hover:bg-rose-50" onClick={deleteSelectedNote}>
                            Sil
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kaydedilen Notlar</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{filteredNoteHistory.length}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setNoteFilterTag("ALL")}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            noteFilterTag === "ALL"
                              ? "border-sky-500 bg-sky-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          )}
                        >
                          Tümü
                        </button>
                        {COACH_NOTE_TAG_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setNoteFilterTag(option.value)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              noteFilterTag === option.value
                                ? "border-sky-500 bg-sky-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="subtle-scroll mt-3 grid max-h-[280px] gap-2 overflow-auto">
                        {filteredNoteHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {noteHistory.length === 0 ? "Henüz kaydedilmiş not bulunmuyor." : "Bu filtrede not bulunmuyor."}
                          </p>
                        ) : (
                          filteredNoteHistory.map((item) => {
                            const parsed = parseCoachNote(item.note);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={cn(
                                  "rounded-[var(--ui-radius-md)] border px-3 py-3 text-left transition",
                                  item.id === selectedHistoryNote?.id
                                    ? "border-sky-300 bg-sky-50 shadow-[var(--ui-shadow-soft)]"
                                    : "border-slate-200 bg-white/90 hover:border-slate-300"
                                )}
                                onClick={() => selectNoteForEditing(item)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {formatDateTime(item.created_at)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold", coachNoteTagTone(parsed.tag))}>
                                      {coachNoteTagLabel(parsed.tag)}
                                    </span>
                                    {item.updated_at !== item.created_at ? (
                                      <span className="text-[10px] font-medium text-sky-700">Güncellendi</span>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-2 text-sm text-slate-800">{truncateNote(parsed.body)}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Ölçüm Trendi</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {measurementTrendRows.length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-chart-line" aria-hidden="true" />}
                        title="Trend verisi bulunmuyor"
                        description="Boy, kilo, yağ ve kas ölçümleri geldikçe burada grafik görünür."
                      />
                    ) : (
                      <>
                        <TrainerMemberMeasurementTrend rows={measurementTrendRows} />
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="detail-pill justify-between px-4 py-3">
                            <span className="text-sm text-slate-700">Boy</span>
                            <strong>{formatUnitValue(latestMeasurement?.height_cm, "cm")}</strong>
                          </div>
                          <div className="detail-pill justify-between px-4 py-3">
                            <span className="text-sm text-slate-700">Kilo</span>
                            <strong>{formatUnitValue(latestMeasurement?.weight_kg, "kg")}</strong>
                          </div>
                          <div className="detail-pill justify-between px-4 py-3">
                            <span className="text-sm text-slate-700">Yağ</span>
                            <strong>{formatUnitValue(latestMeasurement?.fat_percent, "%", true)}</strong>
                          </div>
                          <div className="detail-pill justify-between px-4 py-3">
                            <span className="text-sm text-slate-700">Kas</span>
                            <strong>{formatUnitValue(latestMeasurement?.muscle_kg, "kg")}</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Ölçüm Geçmişi</CardTitle>
                  </CardHeader>
                  <CardContent className="subtle-scroll panel-scroll grid gap-2">
                    {measurements.length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-ruler-combined" aria-hidden="true" />}
                        title="Ölçüm kaydı bulunmuyor"
                        description="Boy, kilo ve kompozisyon verileri burada geçmiş halinde görünür."
                      />
                    ) : (
                      measurements.map((row) => (
                        <article key={row.id} className="list-row text-sm">
                          <strong>{formatDateTime(row.measured_at)}</strong>
                          <p className="mt-1 text-muted-foreground">
                            Boy: {formatMetricValue(row.height_cm)} • Kilo: {formatMetricValue(row.weight_kg)} • Yağ: {formatMetricValue(row.fat_percent)} • Kas: {formatMetricValue(row.muscle_kg)}
                          </p>
                        </article>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Katılım Geçmişi</CardTitle>
                  </CardHeader>
                  <CardContent className="subtle-scroll panel-scroll grid gap-2">
                    {attendance.length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-clipboard-check" aria-hidden="true" />}
                        title="Katılım kaydı bulunmuyor"
                        description="Check-in ve ders katılımı işlendiğinde burada görünür."
                      />
                    ) : (
                      attendance.map((row) => (
                        <article key={row.id} className="list-row text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <strong>{attendanceResultLabel(row.result)}</strong>
                            <Badge variant="secondary">{row.credits_deducted} kredi</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{formatDateTime(row.created_at)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ders: {row.session_title ?? row.lesson_category ?? "Belirlenmedi"}
                          </p>
                        </article>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>Katılım Trendi</CardTitle>
                  </CardHeader>
                  <CardContent className="subtle-scroll panel-scroll grid gap-2">
                    {(detail.attendance_trend || []).length === 0 ? (
                      <EmptyState
                        icon={<i className="fa-solid fa-chart-line" aria-hidden="true" />}
                        title="Trend verisi bulunmuyor"
                        description="Katılım oluştukça haftalık frekans burada görünür."
                      />
                    ) : (
                      (detail.attendance_trend || []).map((trend) => (
                        <article key={trend.week_start} className="list-row text-sm">
                          <p className="font-medium">{formatDate(`${trend.week_start}T00:00:00`)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Haftalık katılım: {trend.count}</p>
                        </article>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
