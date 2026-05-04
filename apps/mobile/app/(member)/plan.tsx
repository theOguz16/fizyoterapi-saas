// Bu sayfa mobil uygulamada member akisindaki plan ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildSlotStartMinutes, normalizeBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { getMemberAvailabilityApi, getMemberHomeApi, patchMemberWeeklyTarget, saveMemberAvailabilityApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SectionTitle } from "@/theme/components/section-title";
import { ActionButton } from "@/theme/components/action-button";
import { MetricTile } from "@/theme/components/metric-tile";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { tokens } from "@/theme/tokens";

type Slot = {
  key: string;
  starts_at: string;
  ends_at: string;
  label: string;
};

const targetOptions = [1, 2, 3, 4, 5, 6, 7];

function startOfIsoWeek(date: Date) {
  const dt = new Date(date);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function buildWeekSlots(businessHours: any, anchorDate: Date) {
  const normalizedBusinessHours = normalizeBusinessHours(businessHours);
  const start = startOfIsoWeek(anchorDate);
  const workingDays = normalizedBusinessHours.working_days;
  const startTime = normalizedBusinessHours.start_time;
  const endTime = normalizedBusinessHours.end_time;
  const lunchStart = normalizedBusinessHours.lunch_break_start;
  const lunchEnd = normalizedBusinessHours.lunch_break_end;
  const slotMinutes = normalizedBusinessHours.slot_minutes;
  const breakMinutes = normalizedBusinessHours.break_duration_minutes;

  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map((piece) => Number(piece || 0));
    return hour * 60 + minute;
  };

  if (!startTime || !endTime) {
  return [];
}

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  const hasLunchBreak = Boolean(lunchStart && lunchEnd);
  const lunchStartMinutes = hasLunchBreak ? toMinutes(lunchStart!) : -1;
  const lunchEndMinutes = hasLunchBreak ? toMinutes(lunchEnd!) : -1;

  const slots: Slot[] = [];
  for (let day = 0; day < 7; day += 1) {
    const isoDay = day + 1;
    if (!workingDays.includes(isoDay)) continue;
    for (const minute of buildSlotStartMinutes(startMinutes, endMinutes, slotMinutes, breakMinutes)) {
      const slotStart = new Date(start);
      slotStart.setDate(start.getDate() + day);
      slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);
      const intersectsLunch = minute < lunchEndMinutes && minute + slotMinutes > lunchStartMinutes;
      if (intersectsLunch) continue;
      slots.push({
        key: slotStart.toISOString(),
        starts_at: slotStart.toISOString(),
        ends_at: slotEnd.toISOString(),
        label: `${slotStart.toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit" })} ${slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      });
    }
  }
  return slots;
}

export default function MemberPlanScreen() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [saveSummary, setSaveSummary] = useState<any>(null);

  const homeQuery = useQuery({ queryKey: ["member-home"], queryFn: getMemberHomeApi });
  const availabilityQuery = useQuery({ queryKey: ["member-availability"], queryFn: getMemberAvailabilityApi });

  const weeklyTarget = Number(homeQuery.data?.member?.weekly_class_hours || 1);
  const requiredSlots = weeklyTarget * 3;
  const requiredTrainerFreeSlots = Math.ceil(requiredSlots * (2 / 3));
  const availabilityRows = Array.isArray(availabilityQuery.data) ? availabilityQuery.data : [];
  const anchorDate = availabilityRows[0]?.starts_at ? new Date(availabilityRows[0].starts_at) : new Date();
  const slotCandidates = useMemo(() => buildWeekSlots(homeQuery.data?.calendar?.business_hours, anchorDate), [homeQuery.data?.calendar?.business_hours, anchorDate]);

  useEffect(() => {
    const keys = availabilityRows.map((row: any) => new Date(row.starts_at).toISOString());
    setSelectedKeys(keys);
  }, [availabilityQuery.data]);

  const targetMutation = useMutation({
  mutationFn: (value: number) => patchMemberWeeklyTarget(value),

  meta: {
    invalidates: [
      ["member-home"],
      ["member-home-v2"],
    ],
  },
});

  const saveMutation = useMutation({
  mutationFn: () =>
    saveMemberAvailabilityApi({
      mode: "REPLACE_WEEK",
      slots: slotCandidates
        .filter((row) => selectedKeys.includes(row.key))
        .map((row) => ({
          starts_at: row.starts_at,
          ends_at: row.ends_at,
        })),
    }),

  meta: {
  invalidates: [
    ["member-home"],
    ["member-home-v2"],
    ["member-availability"],

    ["salon-trainer-options"],
    ["salon-day-options"],

    ["trainer-availabilities"],
    ["trainer-booking-form-options"],
    ["trainer-bookings"],

    ["admin-bookings"],
    ["admin-settings-calendar"],
  ],
},

  onSuccess: (payload) => {
    setSaveSummary(payload?.weekly_plan || null);
  },
});

  const toggleSlot = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  return (
    <AppShell
      title="Uygunluk Planı"
      subtitle="Takvim dışında haftalık müsaitlik hedefini detaylı düzenlemek istersen bu ekranı kullan."
      icon="calendar"
      refreshing={homeQuery.isRefetching || availabilityQuery.isRefetching}
      onRefresh={() => {
        void homeQuery.refetch();
        void availabilityQuery.refetch();
      }}
    >
      <SurfaceCard>
        <SectionTitle title="Ders hedefi" subtitle="1 ile 7 ders arasında haftalık hedefini belirle." />
        <View style={styles.targetRow}>
          {targetOptions.map((option) => {
            const active = weeklyTarget === option;
            return (
              <Pressable key={option} onPress={() => targetMutation.mutate(option)} style={[styles.targetChip, active ? styles.targetChipActive : null]}>
                <Text style={[styles.targetLabel, active ? styles.targetLabelActive : null]}>{option} ders</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <View style={styles.summaryGrid}>
        <MetricTile label="Seçilen" value={selectedKeys.length} hint="İşaretlediğin toplam slot" tone="primary" />
        <MetricTile label="Gerekli" value={requiredSlots} hint="Hedefe göre gereken toplam slot" tone="warning" />
        <MetricTile label="Uyumlu min" value={requiredTrainerFreeSlots} hint="Eğitmenle çakışmaması gereken minimum slot" tone="success" />
      </View>

      <SurfaceCard>
        <SectionTitle title="Kural" subtitle="1 ders = 3 slot. Seçimlerinin en az 2/3'ü eğitmenle uyumlu olmalı." />
        <Text style={styles.bodyText}>Çalışma saatleri ve öğle arası otomatik uygulanır. Seçim sonrası sistem uygunluğu tekrar doğrular.</Text>
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Haftalık grid" subtitle="Dokunarak ders seç veya kaldır." />
        <ScrollPanel maxHeight={360}>
          <View style={styles.slotGrid}>
            {slotCandidates.map((slot) => {
              const selected = selectedKeys.includes(slot.key);
              return (
                <Pressable key={slot.key} onPress={() => toggleSlot(slot.key)} style={[styles.slotChip, selected ? styles.slotChipSelected : null]}>
                  <Text style={[styles.slotLabel, selected ? styles.slotLabelSelected : null]}>{slot.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollPanel>
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Kaydetme özeti" subtitle="Alt bar mantığını tek kartta sabitliyoruz; save sonrası backend doğrulama sonucu burada görünür." />
        <Text style={styles.bodyText}>Seçilen: {selectedKeys.length} / Gerekli: {requiredSlots}</Text>
        <Text style={styles.bodyText}>Uyumlu hedef: {saveSummary?.trainer_free_slots ?? "-"} / Gerekli: {requiredTrainerFreeSlots}</Text>
        <Text style={styles.feedback}>{saveSummary?.message || "Kaydettiğinde backend sonucu burada özetlenecek."}</Text>
        <ActionButton
          label="Haftalık Planı Kaydet"
          icon="calendar"
          onPress={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          disabled={selectedKeys.length < requiredSlots}
        />
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  targetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  targetChip: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
  },
  targetChipActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}22`,
  },
  targetLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontWeight: "700",
  },
  targetLabelActive: {
    color: tokens.colors.text,
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  bodyText: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  slotChip: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  slotChipSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}22`,
  },
  slotLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontWeight: "700",
    lineHeight: 18,
  },
  slotLabelSelected: {
    color: tokens.colors.text,
  },
  feedback: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
  },
});
