// Bu paylasilan UI component'i mobil tasarim sistemindeki calendar agenda parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "./empty-state";
import { ScheduleCard } from "./schedule-card";
import { SegmentedSwitch } from "./segmented-switch";
import { SelectionChip } from "./selection-chip";
import { StatusBadge } from "./status-badge";
import { SurfaceCard } from "./surface-card";
import { tokens } from "../tokens";
import { bookingStatusLabel } from "@/lib/labels";

type BadgeTone = "success" | "warning" | "danger" | "info" | "premium" | "neutral";

export type CalendarAgendaItem = {
  id: string;
  title: string;
  subtitle: string;
  startsAt?: string | null;
  endsAt?: string | null;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  onPress?: () => void;
};

export type CalendarAgendaStat = {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
};

type Props = {
  items: CalendarAgendaItem[];
  stats?: CalendarAgendaStat[];
  emptyTitle: string;
  emptyDescription: string;
  dayEmptyTitle?: string;
  dayEmptyDescription?: string;
};

type DayOption = {
  key: string;
  label: string;
  fullLabel: string;
};

function toDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatCalendarTimeRange(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt) return "-";

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "-";

  const startLabel = start.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!endsAt) return startLabel;

  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startLabel;

  const endLabel = end.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startLabel} - ${endLabel}`;
}

export function formatCalendarDayLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "2-digit",
  });
}

export function formatCalendarDayFullLabel(value?: string | null) {
  if (!value) return "Seçili gün";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Seçili gün";
  return date.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function getStatusTone(status?: string | null): BadgeTone {
  const normalized = status?.toUpperCase();

  if (!normalized) return "neutral";
  if (["APPROVED", "CONFIRMED", "COMPLETED", "ACTIVE", "VERIFIED"].includes(normalized)) return "success";
  if (["PENDING", "WAITING", "REQUESTED"].includes(normalized)) return "warning";
  if (["CANCELLED", "CANCELED", "REJECTED", "FAILED"].includes(normalized)) return "danger";
  if (["RESCHEDULED", "IN_PROGRESS"].includes(normalized)) return "info";
  return "neutral";
}

export function formatStatusLabel(status?: string | null) {
  const normalized = status?.toUpperCase();
  if (!normalized) return "Planlandı";
  if (["APPROVED", "CONFIRMED"].includes(normalized)) return "Onaylandı";
  if (["PENDING", "WAITING", "REQUESTED"].includes(normalized)) return "Onay Bekliyor";
  if (["COMPLETED"].includes(normalized)) return "Tamamlandı";
  if (["ACTIVE"].includes(normalized)) return "Aktif";
  if (["VERIFIED"].includes(normalized)) return "Doğrulandı";
  if (["RESCHEDULED"].includes(normalized)) return "Yeniden Planlandı";
  if (["IN_PROGRESS"].includes(normalized)) return "Devam Ediyor";
  if (["CANCELLED", "CANCELED"].includes(normalized)) return "İptal Edildi";
  if (["REJECTED"].includes(normalized)) return "Reddedildi";
  if (["FAILED"].includes(normalized)) return "Başarısız";
  return bookingStatusLabel(status);
}

export function CalendarAgenda({
  items,
  stats = [],
  emptyTitle,
  emptyDescription,
  dayEmptyTitle = "Bu günde kayıt yok",
  dayEmptyDescription = "Başka bir gün seç veya liste görünümüyle tüm planı incele.",
}: Props) {
  const [viewMode, setViewMode] = useState<"day" | "list">("day");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const first = new Date(a.startsAt || 0).getTime();
        const second = new Date(b.startsAt || 0).getTime();
        return first - second;
      }),
    [items]
  );

  const dayOptions = useMemo<DayOption[]>(() => {
    const grouped = new Map<string, DayOption>();

    sortedItems.forEach((item) => {
      const key = toDateKey(item.startsAt);
      if (!key || grouped.has(key)) return;

      grouped.set(key, {
        key,
        label: formatCalendarDayLabel(item.startsAt),
        fullLabel: formatCalendarDayFullLabel(item.startsAt),
      });
    });

    return Array.from(grouped.values());
  }, [sortedItems]);

  useEffect(() => {
    if (selectedDay && dayOptions.some((day) => day.key === selectedDay)) return;
    setSelectedDay(dayOptions[0]?.key || null);
  }, [dayOptions, selectedDay]);

  const selectedItems = useMemo(() => {
    if (!selectedDay) return [];
    return sortedItems.filter((item) => toDateKey(item.startsAt) === selectedDay);
  }, [selectedDay, sortedItems]);

  if (sortedItems.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon="calendar"
      />
    );
  }

  return (
    <View style={styles.stack}>
      {stats.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          {stats.map((stat) => (
            <SurfaceCard
              key={`${stat.label}-${stat.value}`}
              padding="compact"
              tone={stat.tone || "default"}
              style={styles.statCard}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </SurfaceCard>
          ))}
        </ScrollView>
      ) : null}

      <SegmentedSwitch
        value={viewMode}
        options={[
          { label: "Günlük", value: "day" },
          { label: "Liste", value: "list" },
        ]}
        onChange={(value) => setViewMode(value as "day" | "list")}
      />

      {viewMode === "day" ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {dayOptions.map((day) => (
              <SelectionChip
                key={day.key}
                label={day.label}
                active={day.key === selectedDay}
                onPress={() => setSelectedDay(day.key)}
              />
            ))}
          </ScrollView>

          <SurfaceCard padding="regular">
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>
                {dayOptions.find((day) => day.key === selectedDay)?.fullLabel || "Seçili gün"}
              </Text>
              {selectedItems.length > 0 ? (
                <StatusBadge
                  label={`${selectedItems.length} kayıt`}
                  tone="info"
                />
              ) : null}
            </View>

            <View style={styles.listStack}>
              {selectedItems.length === 0 ? (
                <EmptyState
                  title={dayEmptyTitle}
                  description={dayEmptyDescription}
                  icon="calendar"
                />
              ) : (
                selectedItems.map((item) => (
                  <ScheduleCard
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    timeLabel={formatCalendarTimeRange(item.startsAt, item.endsAt)}
                    badge={
                      item.badgeLabel
                        ? { label: item.badgeLabel, tone: item.badgeTone }
                        : undefined
                    }
                    onPress={item.onPress}
                  />
                ))
              )}
            </View>
          </SurfaceCard>
        </>
      ) : (
        <View style={styles.listStack}>
          {sortedItems.map((item) => (
            <ScheduleCard
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              timeLabel={formatCalendarTimeRange(item.startsAt, item.endsAt)}
              badge={
                item.badgeLabel
                  ? { label: item.badgeLabel, tone: item.badgeTone }
                  : undefined
              }
              onPress={item.onPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: tokens.spacing.sm,
  },
  statsRow: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  statCard: {
    minWidth: 132,
  },
  statValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  statLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  chipsRow: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  dayTitle: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  listStack: {
    gap: tokens.spacing.sm,
  },
});
