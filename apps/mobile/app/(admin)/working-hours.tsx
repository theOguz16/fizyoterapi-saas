import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BUSINESS_HOUR_BREAK_OPTIONS,
  BUSINESS_HOUR_SLOT_OPTIONS,
  resolveBusinessHours,
} from "@/lib/scheduling/business-hours.normalize";
import { businessHoursInvalidates, calendarKeys } from "@/lib/scheduling/calendar-query-keys";
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

type WorkingHoursForm = {
  timezone: string | null;
  start_time: string;
  end_time: string;
  lunch_break_start: string;
  lunch_break_end: string;
  slot_minutes: number;
  break_duration_minutes: number;
  working_days: number[];
};

function createEmptyForm(timezone?: string | null): WorkingHoursForm {
  return {
    timezone: timezone || null,
    start_time: "",
    end_time: "",
    lunch_break_start: "",
    lunch_break_end: "",
    slot_minutes: 60,
    break_duration_minutes: 0,
    working_days: [],
  };
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map((item) => Number(item || 0));
  return hour * 60 + minute;
}

function formatTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export default function AdminWorkingHoursScreen() {
  const router = useRouter();

  const query = useQuery({
    queryKey: calendarKeys.admin.workingHours(),
    queryFn: getAdminSettingsApi,
  });

  const [activeField, setActiveField] = useState<TimeFieldKey | null>(null);
  const [useLunchBreak, setUseLunchBreak] = useState(false);
  const [form, setForm] = useState<WorkingHoursForm>(() => createEmptyForm());

  const settings = query.data || {};
  const profile = settings.profile || settings;
  const location = profile.location || {};

  const hasSavedBusinessHours = useMemo(() => {
    const resolved = resolveBusinessHours([profile.business_hours, location.business_hours], {
      locationTimezone: location.timezone,
    });

    return resolved.is_configured;
  }, [location.business_hours, location.timezone, profile.business_hours]);

  useEffect(() => {
    const currentProfile = query.data?.profile || query.data || {};
    const currentLocation = currentProfile.location || {};

    const initial = resolveBusinessHours([currentProfile.business_hours, currentLocation.business_hours], {
      locationTimezone: currentLocation.timezone,
    });

    if (!initial.is_configured) {
      setForm(createEmptyForm(initial.timezone || currentLocation.timezone || null));
      setUseLunchBreak(false);
      return;
    }

    setForm({
      timezone: initial.timezone || currentLocation.timezone || null,
      start_time: initial.start_time || "",
      end_time: initial.end_time || "",
      lunch_break_start: initial.lunch_break_start || "",
      lunch_break_end: initial.lunch_break_end || "",
      slot_minutes: Number(initial.slot_minutes),
      break_duration_minutes: Number(initial.break_duration_minutes),
      working_days: [...initial.working_days],
    });

    setUseLunchBreak(initial.has_lunch_break);
  }, [query.data]);

  const summary = useMemo(
    () =>
      DAY_OPTIONS.filter((item) => form.working_days.includes(item.value))
        .map((item) => item.label)
        .join(", "),
    [form.working_days]
  );

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
        Number(form.break_duration_minutes || 0) > 0
          ? `${formatTime(lessonEnd)}-${formatTime(breakEnd)} mola`
          : "Mola yok",
      totalBlock: Number(form.slot_minutes || 45) + Number(form.break_duration_minutes || 0),
    };
  }, [form.break_duration_minutes, form.slot_minutes, form.start_time]);

  const lunchPreview = useMemo(() => {
    if (!useLunchBreak) return "Öğle arası kapalı. Takvim slotlarını etkilemez.";
    if (!form.lunch_break_start || !form.lunch_break_end) return "Öğle arası için başlangıç ve bitiş seçin.";
    return `${form.lunch_break_start} - ${form.lunch_break_end} arası takvimde kapalı blok olarak değerlendirilir.`;
  }, [form.lunch_break_end, form.lunch_break_start, useLunchBreak]);

  const mutation = useMutation({
    mutationFn: () => {
      const currentProfile = query.data?.profile || query.data || {};
      const currentLocation = currentProfile.location || {};

      const nextBusinessHours: Record<string, unknown> = {
        timezone: form.timezone || currentLocation.timezone || null,
        start_time: form.start_time,
        end_time: form.end_time,
        slot_minutes: Number(form.slot_minutes),
        break_duration_minutes: Number(form.break_duration_minutes || 0),
        working_days: [...form.working_days],
      };

      if (useLunchBreak && form.lunch_break_start && form.lunch_break_end) {
        nextBusinessHours.lunch_break_start = form.lunch_break_start;
        nextBusinessHours.lunch_break_end = form.lunch_break_end;
      }

      return updateAdminSettingsApi({
        ...(query.data || {}),
        profile: {
          ...((query.data?.profile || query.data || {}) as Record<string, unknown>),
          business_hours: nextBusinessHours,
        },
      });
    },

    meta: {
      invalidates: businessHoursInvalidates,
    },

    onSuccess: async () => {
      await query.refetch();

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
      const nextDays = prev.working_days.includes(value)
        ? prev.working_days.filter((item) => item !== value)
        : [...prev.working_days, value].sort((a, b) => a - b);

      return {
        ...prev,
        working_days: nextDays,
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
    if (!form.start_time || !form.end_time) {
      showInfoAlert("Saat seçimi eksik", "Açılış ve kapanış saatlerini seçmeden kaydedemezsiniz.");
      return;
    }

    if (toMinutes(form.start_time) >= toMinutes(form.end_time)) {
      showInfoAlert("Saat aralığı hatalı", "Kapanış saati açılış saatinden sonra olmalı.");
      return;
    }

    if (!form.working_days.length) {
      showInfoAlert("Çalışma günü eksik", "En az bir çalışma günü seçmeniz gerekiyor.");
      return;
    }

    if (useLunchBreak) {
      if (!form.lunch_break_start || !form.lunch_break_end) {
        showInfoAlert(
          "Öğle arası eksik",
          "Öğle arası kullanacaksan başlangıç ve bitiş saatini birlikte seçmelisin."
        );
        return;
      }

      const lunchStart = toMinutes(form.lunch_break_start);
      const lunchEnd = toMinutes(form.lunch_break_end);
      const dayStart = toMinutes(form.start_time);
      const dayEnd = toMinutes(form.end_time);

      if (lunchStart >= lunchEnd) {
        showInfoAlert("Öğle arası hatalı", "Öğle arası bitişi başlangıç saatinden sonra olmalı.");
        return;
      }

      if (lunchStart < dayStart || lunchEnd > dayEnd) {
        showInfoAlert(
          "Öğle arası çalışma saatleri dışında",
          "Öğle arası, açılış ve kapanış saatleri arasında olmalı."
        );
        return;
      }
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
          <MetricCard label="Kapanış" value={form.end_time || "Seçilmedi"} hint="Gün sonu" icon="calendar" />
          <MetricCard label="Ders" value={`${form.slot_minutes} dk`} hint="Takvime yansır" icon="calendar" />
          <MetricCard label="Mola" value={form.break_duration_minutes ? `${form.break_duration_minutes} dk` : "Yok"} hint="Blok sonu" icon="clock" />
        </View>

        <SurfaceCard tone="primary">
          <Text style={styles.cardTitle}>Takvim görünümü bu ayarlara göre oluşturulur</Text>
          <Text style={styles.copy}>
            {hasSavedBusinessHours
              ? "Üye, eğitmen ve yönetici takvimlerinde görünen müsait saatler bu çalışma düzenine göre hesaplanır."
              : "Hazır örnek saatler göstermiyoruz. Saatleri ve çalışma günlerini salon düzeninize göre siz belirleyin."}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Saat dilimi</Text>
            <Text style={styles.infoValue}>{form.timezone || location.timezone || "Salon lokasyonundan belirlenemedi"}</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Saat aralıkları</Text>
          <TimeField
            label="Açılış saati"
            value={form.start_time}
            placeholder="Açılış saatini seç"
            onPress={() => setActiveField("start_time")}
          />
          <TimeField
            label="Kapanış saati"
            value={form.end_time}
            placeholder="Kapanış saatini seç"
            onPress={() => setActiveField("end_time")}
          />
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Öğle arası</Text>
          <Text style={styles.copy}>
            Öğle arası kullanmak istemiyorsan kapalı bırak. Kapalı olduğunda takvim slotlarını ve çalışma saati hesaplamalarını etkilemez.
          </Text>

          <View style={styles.chipRow}>
            <SelectionChip
              label={useLunchBreak ? "Öğle arası aktif" : "Öğle arası yok"}
              active={useLunchBreak}
              onPress={() => {
                setUseLunchBreak((prev) => {
                  const next = !prev;

                  if (!next) {
                    setForm((current) => ({
                      ...current,
                      lunch_break_start: "",
                      lunch_break_end: "",
                    }));
                  }

                  return next;
                });
              }}
            />
          </View>

          <Text style={styles.previewText}>{lunchPreview}</Text>

          {useLunchBreak ? (
            <View style={styles.lunchFields}>
              <TimeField
                label="Öğle arası başlangıcı"
                value={form.lunch_break_start}
                placeholder="Başlangıç saatini seç"
                onPress={() => setActiveField("lunch_break_start")}
              />
              <TimeField
                label="Öğle arası bitişi"
                value={form.lunch_break_end}
                placeholder="Bitiş saatini seç"
                onPress={() => setActiveField("lunch_break_end")}
              />
            </View>
          ) : null}
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Çalışma günleri</Text>
          <Text style={styles.copy}>Seçili günler: {summary || "Henüz seçilmedi"}</Text>
          <View style={styles.chipRow}>
            {DAY_OPTIONS.map((item) => (
              <SelectionChip
                key={item.value}
                label={item.label}
                active={form.working_days.includes(item.value)}
                onPress={() => toggleWorkingDay(item.value)}
              />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Ders süresi</Text>
          <Text style={styles.copy}>Takvimde görünen her ders bloğu aşağıdaki süreyle oluşturulur.</Text>
          <View style={styles.chipRow}>
            {BUSINESS_HOUR_SLOT_OPTIONS.map((value) => (
              <SelectionChip
                key={value}
                label={`${value} dk`}
                active={form.slot_minutes === value}
                onPress={() => setForm((prev) => ({ ...prev, slot_minutes: value }))}
              />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Ders arası mola</Text>
          <Text style={styles.copy}>
            Mola süresi eklenirse takvimde dersler arasında otomatik boşluk bırakılır. Örn: 09:00-09:45, sonraki ders 10:00.
          </Text>
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
              <Pressable
                key={value}
                onPress={() => activeField && setTime(activeField, value)}
                style={({ pressed }) => [styles.timeRow, pressed ? styles.timeRowPressed : null]}
              >
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

function TimeField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
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
  infoRow: {
    marginTop: tokens.spacing.sm,
    gap: 2,
  },
  infoLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  infoValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
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
  lunchFields: {
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