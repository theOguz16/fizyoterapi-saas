import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BUSINESS_HOUR_BREAK_OPTIONS,
  BUSINESS_HOUR_SLOT_OPTIONS,
  resolveBusinessHours,
} from "@/lib/business-hours";
import { getAdminSettingsApi, updateAdminSettingsApi } from "@/lib/mobile-api";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { SelectionChip } from "@/theme/components/selection-chip";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

const DAY_OPTIONS = [
  { value: 1, label: "Pzt" },
  { value: 2, label: "Sal" },
  { value: 3, label: "Çar" },
  { value: 4, label: "Per" },
  { value: 5, label: "Cum" },
  { value: 6, label: "Cmt" },
  { value: 7, label: "Paz" },
] as const;

const TIME_OPTIONS = buildTimeOptions();

type TimeFieldKey = "start_time" | "end_time" | "lunch_break_start" | "lunch_break_end";

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map((item) => Number(item || 0));
  return hour * 60 + minute;
}

function formatTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export default function AdminWorkingHoursScreen() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["admin-working-hours"], queryFn: getAdminSettingsApi });
  const [activeField, setActiveField] = useState<TimeFieldKey | null>(null);
  const [form, setForm] = useState({
    start_time: "",
    end_time: "",
    lunch_break_start: "",
    lunch_break_end: "",
    slot_minutes: 60,
    break_duration_minutes: 0,
    working_days: [] as number[],
  });
  const hasSavedBusinessHours =
    hasConfiguredBusinessHours(query.data?.profile?.business_hours) || hasConfiguredBusinessHours((query.data?.profile || query.data || {}).location?.business_hours);

  useEffect(() => {
    const profile = query.data?.profile || query.data || {};
    if (!hasConfiguredBusinessHours(profile.business_hours) && !hasConfiguredBusinessHours(profile.location?.business_hours)) {
      setForm({
        start_time: "",
        end_time: "",
        lunch_break_start: "",
        lunch_break_end: "",
        slot_minutes: 60,
        break_duration_minutes: 0,
        working_days: [],
      });
      return;
    }
    const initial = resolveBusinessHours(profile.business_hours, profile.location?.business_hours);
    setForm({
      start_time: String(initial.start_time),
      end_time: String(initial.end_time),
      lunch_break_start: String(initial.lunch_break_start),
      lunch_break_end: String(initial.lunch_break_end),
      slot_minutes: Number(initial.slot_minutes),
      break_duration_minutes: Number(initial.break_duration_minutes),
      working_days: [...initial.working_days],
    });
  }, [query.data]);

  const summary = useMemo(() => DAY_OPTIONS.filter((item) => form.working_days.includes(item.value)).map((item) => item.label).join(", "), [form.working_days]);
  const flowPreview = useMemo(() => {
    if (!form.start_time) {
      return {
        lessonLine: "Önce açılış saatini seçin",
        breakLine: "Mola akışı saat seçimine göre hesaplanır",
        totalBlock: Number(form.slot_minutes || 45) + Number(form.break_duration_minutes || 0),
      };
    }
    const lessonStart = toMinutes(form.start_time);
    const lessonEnd = lessonStart + Number(form.slot_minutes || 45);
    const breakEnd = lessonEnd + Number(form.break_duration_minutes || 0);
    return {
      lessonLine: `${formatTime(lessonStart)}-${formatTime(lessonEnd)} ders`,
      breakLine:
        Number(form.break_duration_minutes || 0) > 0 ? `${formatTime(lessonEnd)}-${formatTime(breakEnd)} mola` : "Mola yok",
      totalBlock: Number(form.slot_minutes || 45) + Number(form.break_duration_minutes || 0),
    };
  }, [form.break_duration_minutes, form.slot_minutes, form.start_time]);

  const mutation = useMutation({
  mutationFn: () =>
    updateAdminSettingsApi({
      ...(query.data || {}),
      profile: {
        ...((query.data?.profile || query.data || {}) as Record<string, unknown>),
        business_hours: form,
      },
    }),

  meta: {
    invalidates: [
      ["admin-settings"],
      ["admin-settings-calendar"],
      ["member-home"],
      ["member-home-v2"],
      ["member-home-calendar"],
      ["trainer-today"],
      ["trainer-today-calendar"],
      ["salon-day-options"],
      ["salon-trainer-options"],
      ["public-salons"],
      ["shared-clinics"]
    ],
  },

  onSuccess: () => {
    showInfoAlert(
      "Çalışma saatleri güncellendi",
      "Salon takvimi ve bağlı kullanıcı ekranları yeni çalışma düzenine göre yenilendi."
    );
  },

  onError: (error: unknown) => {
    showErrorAlert(
      "Çalışma saatleri kaydedilemedi",
      error,
      "Salon çalışma saatleri güncellenemedi. Lütfen tekrar deneyin."
    );
  },
});

  function toggleWorkingDay(value: number) {
    setForm((prev) => {
      const nextDays = prev.working_days.includes(value) ? prev.working_days.filter((item) => item !== value) : [...prev.working_days, value].sort((a, b) => a - b);
      return {
        ...prev,
        working_days: nextDays.length ? nextDays : prev.working_days,
      };
    });
  }

  function setTime(field: TimeFieldKey, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setActiveField(null);
  }

  function handleSave() {
    if (!form.start_time || !form.end_time || !form.lunch_break_start || !form.lunch_break_end) {
      showInfoAlert("Saat seçimi eksik", "Açılış, kapanış ve öğle arası saatlerini seçmeden kaydedemezsiniz.");
      return;
    }
    if (!form.working_days.length) {
      showInfoAlert("Çalışma günü eksik", "En az bir çalışma günü seçmeniz gerekiyor.");
      return;
    }
    mutation.mutate();
  }

  return (
    <>
      <AppShell
        title="Çalışma saatlerini düzenle"
        subtitle="Açılış, kapanış, öğle arası ve slot süresi salon takvimini doğrudan belirler."
        icon="clock"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onBack={() => router.replace("/(admin)/salon" as never)}
      >
        <View style={styles.metricsRow}>
          <MetricCard label="Açılış" value={form.start_time || "Seçilmedi"} hint="Gün başlangıcı" icon="clock" />
          <MetricCard label="Ders" value={`${form.slot_minutes} dk`} hint="Takvime yansır" icon="calendar" />
          <MetricCard label="Mola" value={form.break_duration_minutes ? `${form.break_duration_minutes} dk` : "Yok"} hint="Blok sonu" icon="clock" />
        </View>

        <SurfaceCard tone="primary">
          <Text style={styles.cardTitle}>Takvim görünümü bu ayarlara göre oluşturulur</Text>
          <Text style={styles.copy}>{hasSavedBusinessHours ? "Üye, eğitmen ve yönetici takvimlerinde görünen müsait saatler bu çalışma düzenine göre hesaplanır." : "Hazır örnek saatler göstermiyoruz. Saatleri ve çalışma günlerini salon düzeninize göre siz belirleyin."}</Text>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Saat aralıkları</Text>
          <TimeField label="Açılış saati" value={form.start_time} placeholder="Açılış saatini seç" onPress={() => setActiveField("start_time")} />
          <TimeField label="Kapanış saati" value={form.end_time} placeholder="Kapanış saatini seç" onPress={() => setActiveField("end_time")} />
          <TimeField label="Öğle arası başlangıcı" value={form.lunch_break_start} placeholder="Öğle arası başlangıcını seç" onPress={() => setActiveField("lunch_break_start")} />
          <TimeField label="Öğle arası bitişi" value={form.lunch_break_end} placeholder="Öğle arası bitişini seç" onPress={() => setActiveField("lunch_break_end")} />
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Çalışma günleri</Text>
          <Text style={styles.copy}>Seçili günler: {summary || "Henüz seçilmedi"}</Text>
          <View style={styles.chipRow}>
            {DAY_OPTIONS.map((item) => (
              <SelectionChip key={item.value} label={item.label} active={form.working_days.includes(item.value)} onPress={() => toggleWorkingDay(item.value)} />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Ders süresi</Text>
          <Text style={styles.copy}>Takvimde görünen her ders bloğu aşağıdaki süreyle oluşturulur.</Text>
          <View style={styles.chipRow}>
            {BUSINESS_HOUR_SLOT_OPTIONS.map((value) => (
              <SelectionChip key={value} label={`${value} dk`} active={form.slot_minutes === value} onPress={() => setForm((prev) => ({ ...prev, slot_minutes: value }))} />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Ders arası mola</Text>
          <Text style={styles.copy}>Mola süresi eklenirse takvimde dersler arasında otomatik boşluk bırakılır. Örn: 09:00-09:45, sonraki ders 10:00.</Text>
          <Text style={styles.fieldLabel}>Mola süresi</Text>
          <View style={styles.chipRow}>
            {BUSINESS_HOUR_BREAK_OPTIONS.map((value) => (
              <SelectionChip
                key={value}
                label={value === 0 ? "Molasız" : `${value} dk`}
                active={form.break_duration_minutes === value}
                onPress={() => setForm((prev) => ({ ...prev, break_duration_minutes: value }))}
              />
            ))}
          </View>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Örnek akış</Text>
            <Text style={styles.previewText}>{flowPreview.lessonLine}</Text>
            <Text style={styles.previewText}>{flowPreview.breakLine}</Text>
            <Text style={styles.previewText}>Bir sonraki ders başlangıcı: +{flowPreview.totalBlock} dk</Text>
          </View>
        </SurfaceCard>

        <ActionButton label="Değişiklikleri kaydet" icon="clock" onPress={handleSave} loading={mutation.isPending} />
      </AppShell>

      <Modal visible={activeField !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveField(null)}>
        <View style={styles.sheetSafe}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setActiveField(null)} style={styles.sheetClose}>
              <AppIcon name="arrow-left" size="sm" tone="neutral" variant="plain" />
            </Pressable>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>{resolveFieldTitle(activeField)}</Text>
              <Text style={styles.sheetSubtitle}>15 dakikalık aralıklarla saat seçebilirsin.</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.timeList}>
            {TIME_OPTIONS.map((value) => (
              <Pressable key={value} onPress={() => activeField && setTime(activeField, value)} style={({ pressed }) => [styles.timeRow, pressed ? styles.timeRowPressed : null]}>
                <Text style={styles.timeLabel}>{value}</Text>
                <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function TimeField({ label, value, placeholder, onPress }: { label: string; value: string; placeholder: string; onPress: () => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.fieldButton, pressed ? styles.fieldButtonPressed : null]}>
        <Text style={[styles.fieldValue, !value ? styles.fieldPlaceholder : null]}>{value || placeholder}</Text>
        <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
      </Pressable>
    </View>
  );
}

function hasConfiguredBusinessHours(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    start_time?: unknown;
    end_time?: unknown;
    lunch_break_start?: unknown;
    lunch_break_end?: unknown;
    working_days?: unknown;
  };
  if (typeof candidate.start_time === "string" && candidate.start_time.trim()) return true;
  if (typeof candidate.end_time === "string" && candidate.end_time.trim()) return true;
  if (typeof candidate.lunch_break_start === "string" && candidate.lunch_break_start.trim()) return true;
  if (typeof candidate.lunch_break_end === "string" && candidate.lunch_break_end.trim()) return true;
  return Array.isArray(candidate.working_days) && candidate.working_days.length > 0;
}

function resolveFieldTitle(field: TimeFieldKey | null) {
  if (field === "start_time") return "Açılış saati";
  if (field === "end_time") return "Kapanış saati";
  if (field === "lunch_break_start") return "Öğle arası başlangıcı";
  if (field === "lunch_break_end") return "Öğle arası bitişi";
  return "Saat seç";
}

function buildTimeOptions() {
  const options: string[] = [];
  for (let hour = 6; hour <= 23; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return options;
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  fieldButton: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    ...tokens.shadow.soft,
  },
  fieldButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  fieldValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  fieldPlaceholder: {
    color: tokens.colors.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  previewCard: {
    gap: 4,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.md,
  },
  previewTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  previewText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  sheetSafe: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  sheetTitleWrap: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  sheetSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  timeList: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  timeRow: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  timeLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
});
