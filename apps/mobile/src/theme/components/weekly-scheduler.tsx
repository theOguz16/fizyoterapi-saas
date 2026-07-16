// Bu paylasilan UI component'i mobil tasarim sistemindeki weekly scheduler parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { EmptyState } from "./empty-state";
import { StatusBadge } from "./status-badge";
import { SurfaceCard } from "./surface-card";
import { VirtualListPanel } from "./virtual-list-panel";
import { buildSlotStartMinutes, normalizeBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { tokens } from "../tokens";
import type { CalendarAgendaItem } from "./calendar-agenda";

type BadgeTone = NonNullable<CalendarAgendaItem["badgeTone"]>;

export type WeeklySchedulerEvent = {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt?: string | null;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  draggable?: boolean;
  onPress?: () => void;
  actionLabel?: string;
  actionIcon?: AppIconName;
  actionTestID?: string;
  onAction?: () => void;
};

export type WeeklySchedulerRequest = {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt?: string | null;
  packageLabel?: string;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  onPress?: () => void;
};

type Props = {
  mode: "member" | "trainer" | "admin";
  events: WeeklySchedulerEvent[];
  requests?: WeeklySchedulerRequest[];
  onEventDrop?: (payload: {
    event: WeeklySchedulerEvent;
    startsAt: string;
    endsAt: string;
  }) => void;
  initialDate?: string | null;
  emptyTitle: string;
  emptyDescription: string;
  requestTitle?: string;
  requestDescription?: string;
  startHour?: number;
  endHour?: number;
  slotMinutes?: number;
  showRequestPanel?: boolean;
  hideEmptyState?: boolean;
  selectedSlotKey?: string | null;
  highlightedSlotKeys?: string[];
  canDropSlotKeys?: string[];
  dropTargetSlotKey?: string | null;
  externalDropActive?: boolean;
  onSlotLayout?: (payload: { key: string; pageY: number; height: number; startsAt: string; endsAt: string }) => void;
  onSelectedDateChange?: (payload: { key: string; date: Date }) => void;
  onSelectedSlotChange?: (payload: { key: string; startsAt: string; endsAt: string }) => void;
  businessHours?: {
    start_time?: string | null;
    end_time?: string | null;
    lunch_break_start?: string | null;
    lunch_break_end?: string | null;
    slot_minutes?: number | null;
    break_duration_minutes?: number | null;
    working_days?: number[] | null;
  } | null;
  viewMode?: "timeline" | "agenda";
  timezone?: string;
};

const SLOT_HEIGHT = 78;
const DAY_DRAG_THRESHOLD = 88;

type WeekDay = {
  index: number;
  date: Date;
  key: string;
  title: string;
  subtitle: string;
  shortWeekday: string;
  fullWeekday: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDateKey(value: Date | string, timezone?: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return `${year}-${month}-${day}`;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateInput: Date) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(dateInput: Date, days: number) {
  const next = new Date(dateInput);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(dateInput: Date, minutes: number) {
  return new Date(dateInput.getTime() + minutes * 60 * 1000);
}

function formatWeekday(date: Date) {
  return date
    .toLocaleDateString("tr-TR", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
}

function formatFullWeekday(date: Date) {
  return date.toLocaleDateString("tr-TR", { weekday: "long" });
}

function formatDayTitle(date: Date) {
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatLongDayTitle(date: Date) {
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
  });
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  })} - ${weekEnd.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  })}`;
}

function formatTime(value?: string | null, timezone?: string) {
  if (!value) return "--:--";
  const date = new Date(value);
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function formatTimeRange(startsAt?: string | null, endsAt?: string | null, timezone?: string) {
  return `${formatTime(startsAt, timezone)}${endsAt ? ` - ${formatTime(endsAt, timezone)}` : ""}`;
}

function buildWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      index,
      date,
      key: toDateKey(date),
      title: formatDayTitle(date),
      subtitle: formatWeekday(date),
      shortWeekday: formatWeekday(date),
      fullWeekday: formatFullWeekday(date),
    };
  });
}

function timeToMinutes(value?: string | null, fallback = 0) {
  if (!value) return fallback;
  const [hour, minute] = String(value).split(":").map((piece) => Number(piece || 0));
  return hour * 60 + minute;
}

function isoDayNumber(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function createSlots(startMinutes: number, endMinutes: number, slotMinutes: number, cycleMinutes: number) {
  const breakMinutes = Math.max(0, cycleMinutes - slotMinutes);
  return buildSlotStartMinutes(startMinutes, endMinutes, slotMinutes, breakMinutes).map((totalMinutes, index) => {
    const hour = `${Math.floor(totalMinutes / 60)}`.padStart(2, "0");
    const minute = `${totalMinutes % 60}`.padStart(2, "0");
    return {
      index,
      totalMinutes,
      label: `${hour}:${minute}`,
    };
  });
}

function buildLunchSlotMeta(
  slots: Array<{ index: number; totalMinutes: number }>,
  slotMinutes: number,
  lunchStartMinutes: number,
  lunchEndMinutes: number
) {
  return slots.map((slot, index) => {
    const slotStartMinutes = slot.totalMinutes;
    const slotEndMinutes = slot.totalMinutes + slotMinutes;
    const isLunchBreak =
      lunchStartMinutes >= 0 &&
      lunchEndMinutes >= 0 &&
      slotStartMinutes < lunchEndMinutes &&
      slotEndMinutes > lunchStartMinutes;

    if (!isLunchBreak) {
      return {
        isLunchBreak: false,
        shouldRenderLunch: false,
        lunchSlotSpan: 1,
      };
    }

    const previousSlot = slots[index - 1];
    const previousIsLunchBreak =
      typeof previousSlot?.totalMinutes === "number" &&
      previousSlot.totalMinutes < lunchEndMinutes &&
      previousSlot.totalMinutes + slotMinutes > lunchStartMinutes;

    if (previousIsLunchBreak) {
      return {
        isLunchBreak: true,
        shouldRenderLunch: false,
        lunchSlotSpan: 0,
      };
    }

    let lunchSlotSpan = 1;
    for (let nextIndex = index + 1; nextIndex < slots.length; nextIndex += 1) {
      const nextSlot = slots[nextIndex];
      const nextIsLunchBreak =
        nextSlot.totalMinutes < lunchEndMinutes &&
        nextSlot.totalMinutes + slotMinutes > lunchStartMinutes;
      if (!nextIsLunchBreak) break;
      lunchSlotSpan += 1;
    }

    return {
      isLunchBreak: true,
      shouldRenderLunch: true,
      lunchSlotSpan,
    };
  });
}

function slotIndexForDate(value: string, startMinutes: number, cycleMinutes: number) {
  const date = new Date(value);
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  return Math.round((totalMinutes - startMinutes) / cycleMinutes);
}

function eventDurationMinutes(event: WeeklySchedulerEvent) {
  if (!event.endsAt) return 60;
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  const diff = Math.max(30, Math.round((end - start) / (60 * 1000)));
  return diff;
}

function toneToCardStyle(tone?: BadgeTone) {
  switch (tone) {
    case "success":
      return {
        backgroundColor: tokens.colors.successSoft,
        borderColor: "rgba(16,155,116,0.24)",
      };
    case "warning":
      return {
        backgroundColor: tokens.colors.warningSoft,
        borderColor: "rgba(245,158,11,0.28)",
      };
    case "danger":
      return {
        backgroundColor: "#FFF1F2",
        borderColor: "rgba(239,68,68,0.24)",
      };
    case "info":
      return {
        backgroundColor: tokens.colors.infoSoft,
        borderColor: "rgba(93,173,226,0.24)",
      };
    case "premium":
      return {
        backgroundColor: "rgba(124,58,237,0.08)",
        borderColor: "rgba(124,58,237,0.24)",
      };
    default:
      return {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.borderStrong,
      };
  }
}

export function WeeklyScheduler({
  mode,
  events,
  requests = [],
  onEventDrop,
  initialDate,
  emptyTitle,
  emptyDescription,
  requestTitle = "Ders talepleri",
  requestDescription = "Planlanmayı bekleyen talepler burada listelenir.",
  startHour = 8,
  endHour = 22,
  slotMinutes = 60,
  showRequestPanel = true,
  hideEmptyState = false,
  selectedSlotKey = null,
  highlightedSlotKeys = [],
  canDropSlotKeys = [],
  dropTargetSlotKey = null,
  externalDropActive = false,
  onSlotLayout,
  onSelectedDateChange,
  onSelectedSlotChange,
  businessHours,
  viewMode = "timeline",
  timezone = "Europe/Istanbul",
}: Props) {
  const anchorDate = useMemo(() => {
    const source = initialDate || events[0]?.startsAt || requests[0]?.startsAt || new Date();
    const clinicDateKey = toDateKey(source, timezone);
    return new Date(`${clinicDateKey}T12:00:00`);
  }, [events, initialDate, requests, timezone]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(anchorDate));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(anchorDate));
  const fade = useRef(new Animated.Value(1)).current;

  const normalizedBusinessHours = useMemo(() => normalizeBusinessHours(businessHours), [businessHours]);
  const effectiveStartMinutes = timeToMinutes(normalizedBusinessHours.start_time, startHour * 60);
  const effectiveEndMinutes = timeToMinutes(normalizedBusinessHours.end_time, endHour * 60);
  const effectiveSlotMinutes = Math.max(30, Number(normalizedBusinessHours.slot_minutes || slotMinutes));
  const effectiveBreakMinutes = Math.max(0, Number((normalizedBusinessHours as any).break_duration_minutes || 0));
  const effectiveCycleMinutes = effectiveSlotMinutes + effectiveBreakMinutes;
  const hasLunchBreak =
  Boolean(normalizedBusinessHours.has_lunch_break) &&
  Boolean(normalizedBusinessHours.lunch_break_start && normalizedBusinessHours.lunch_break_end);

  const lunchStartMinutes = hasLunchBreak
    ? timeToMinutes(normalizedBusinessHours.lunch_break_start, -1)
    : -1;

  const lunchEndMinutes = hasLunchBreak
    ? timeToMinutes(normalizedBusinessHours.lunch_break_end, -1)
    : -1;
  const workingDays = normalizedBusinessHours.working_days;

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const slots = useMemo(
    () => createSlots(effectiveStartMinutes, effectiveEndMinutes, effectiveSlotMinutes, effectiveCycleMinutes),
    [effectiveCycleMinutes, effectiveEndMinutes, effectiveSlotMinutes, effectiveStartMinutes]
  );
  const lunchSlotMeta = useMemo(
    () => buildLunchSlotMeta(slots, effectiveSlotMinutes, lunchStartMinutes, lunchEndMinutes),
    [effectiveSlotMinutes, lunchEndMinutes, lunchStartMinutes, slots]
  );

  useEffect(() => {
    const weekContainsSelected = weekDays.some((day) => day.key === selectedDateKey);
    if (!weekContainsSelected) {
      setSelectedDateKey(weekDays[0]?.key || toDateKey(weekStart));
    }
  }, [selectedDateKey, weekDays, weekStart]);

  useEffect(() => {
    fade.setValue(0.6);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [fade, selectedDateKey, weekStart]);

  const selectedDay = weekDays.find((day) => day.key === selectedDateKey) || weekDays[0];
  const weekDayKeys = useMemo(() => new Set(weekDays.map((day) => day.key)), [weekDays]);
  const selectedDayWorking = selectedDay ? workingDays.includes(isoDayNumber(selectedDay.date)) : true;

  useEffect(() => {
    if (!selectedDay) return;
    onSelectedDateChange?.({ key: selectedDay.key, date: selectedDay.date });
  }, [onSelectedDateChange, selectedDay]);

  const weekEvents = useMemo(
    () =>
      events
        .filter((event) => weekDayKeys.has(toDateKey(event.startsAt, timezone)))
        .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()),
    [events, timezone, weekDayKeys]
  );

  const dayEvents = useMemo(
    () => weekEvents.filter((event) => toDateKey(event.startsAt, timezone) === selectedDateKey),
    [selectedDateKey, timezone, weekEvents]
  );

  const weekRequests = useMemo(
    () =>
      requests
        .filter((request) => weekDayKeys.has(toDateKey(request.startsAt, timezone)))
        .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()),
    [requests, timezone, weekDayKeys]
  );

  function shiftWeek(direction: -1 | 1) {
    const nextWeekStart = addDays(weekStart, direction * 7);
    setWeekStart(nextWeekStart);
    const selectedIndex = selectedDay?.index ?? 0;
    setSelectedDateKey(toDateKey(addDays(nextWeekStart, selectedIndex)));
  }

  return (
    <View style={styles.stack}>
      <SurfaceCard style={styles.weekCard} padding="compact">
        <View style={styles.weekHeader}>
          <Pressable style={styles.arrowButton} onPress={() => shiftWeek(-1)}>
            <AppIcon name="arrow-left" tone="neutral" variant="plain" />
          </Pressable>
          <View style={styles.weekHeaderText}>
            <Text style={styles.weekTitle}>Haftalık Takvim</Text>
            <Text style={styles.weekSubtitle}>{formatWeekRange(weekStart)}</Text>
          </View>
          <Pressable style={styles.arrowButton} onPress={() => shiftWeek(1)}>
            <AppIcon name="arrow-right" tone="neutral" variant="plain" />
          </Pressable>
        </View>

        <View style={styles.daysRow}>
          {weekDays.map((day) => {
            const count =
              weekEvents.filter((event) => toDateKey(event.startsAt, timezone) === day.key).length +
              weekRequests.filter((request) => toDateKey(request.startsAt, timezone) === day.key).length;
            const selected = day.key === selectedDateKey;
            const isWorkingDay = workingDays.includes(isoDayNumber(day.date));
            return (
              <Pressable
                key={day.key}
                onPress={() => setSelectedDateKey(day.key)}
                style={[styles.dayPill, !isWorkingDay ? styles.dayPillDisabled : null, selected ? styles.dayPillActive : null]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[styles.dayTitle, selected ? styles.dayTitleActive : null]}
                >
                  {day.title}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[styles.daySubtitle, selected ? styles.daySubtitleActive : null]}
                >
                  {day.subtitle}
                </Text>
                <View style={[styles.dayCountWrap, !isWorkingDay ? styles.dayCountWrapDisabled : null, selected ? styles.dayCountWrapActive : null]}>
                  <Text style={[styles.dayCount, !isWorkingDay ? styles.dayCountDisabled : null, selected ? styles.dayCountActive : null]}>{isWorkingDay ? count : "-"}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      {mode === "trainer" && showRequestPanel ? (
        <SurfaceCard tone="primary">
          <Text style={styles.sectionTitle}>{requestTitle}</Text>
          <Text style={styles.sectionSubtitle}>{requestDescription}</Text>
          {weekRequests.length === 0 ? (
            <EmptyState
              title="Kayıt bulunmuyor"
              description="Bu hafta için planlama bekleyen talep bulunmuyor."
              icon="request"
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.requestRow}
            >
              {weekRequests.map((request) => (
                <Pressable
                  key={request.id}
                  onPress={request.onPress}
                  style={[
                    styles.requestCard,
                    toneToCardStyle(request.badgeTone || "warning"),
                    toDateKey(request.startsAt, timezone) === selectedDateKey ? styles.requestCardActive : null,
                  ]}
                >
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestDay}>{formatDayTitle(new Date(request.startsAt))}</Text>
                    {request.badgeLabel ? (
                      <StatusBadge label={request.badgeLabel} tone={request.badgeTone || "warning"} />
                    ) : null}
                  </View>
                  <Text style={styles.requestTitle}>{request.title}</Text>
                  <Text style={styles.requestText}>{request.subtitle}</Text>
                  <Text style={styles.requestMeta}>{formatTimeRange(request.startsAt, request.endsAt)}</Text>
                  {request.packageLabel ? <Text style={styles.requestMeta}>Paket: {request.packageLabel}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </SurfaceCard>
      ) : null}

      <Animated.View style={{ opacity: fade }}>
        <SurfaceCard style={externalDropActive ? styles.timelineCardActive : undefined}>
          <View style={styles.timelineHeader}>
            <View style={styles.timelineHeaderTopRow}>
              <Text style={styles.sectionTitle}>{selectedDay ? formatLongDayTitle(selectedDay.date) : "Seçili gün"}</Text>
              <StatusBadge
                label={`${dayEvents.length} ${dayEvents.length === 1 ? "ders" : "ders"}`}
                tone="primary"
              />
            </View>
            <Text style={styles.sectionSubtitle}>
              {selectedDay?.fullWeekday || ""} günü için {mode === "member" ? "ders programı" : "takvim görünümü"}
            </Text>
          </View>

          {!selectedDayWorking ? (
            <EmptyState title="Salon bugün kapalı" description="Çalışma takvimi salon ayarlarına göre gösterilir." icon="calendar" />
          ) : dayEvents.length === 0 ? (
            hideEmptyState ? null : (
              <EmptyState title={emptyTitle} description={emptyDescription} icon="calendar" />
            )
          ) : viewMode === "agenda" ? (
            <VirtualListPanel
              data={dayEvents}
              keyExtractor={(event) => event.id}
              maxHeight={520}
              testID={`${mode}-calendar-agenda`}
              renderItem={(event) => (
                <AgendaEventRow event={event} timezone={timezone} onPress={event.onPress} />
              )}
            />
          ) : (
            <View style={styles.slotStack}>
              {slots.map((slot) => {
                const lunchMeta = lunchSlotMeta[slot.index] || { isLunchBreak: false, shouldRenderLunch: false, lunchSlotSpan: 1 };
                const slotKey = `${selectedDateKey}-${slot.label}`;
                const slotEvents = dayEvents.filter(
                  (event) => slotIndexForDate(event.startsAt, effectiveStartMinutes, effectiveCycleMinutes) === slot.index
                );
                const isLunchBreak = lunchMeta.isLunchBreak;
                if (isLunchBreak && !lunchMeta.shouldRenderLunch) {
                  return null;
                }
                const slotStart = new Date(selectedDay.date);
                slotStart.setHours(0, 0, 0, 0);
                const dayStart = addMinutes(slotStart, effectiveStartMinutes);
                const slotStartsAt = addMinutes(dayStart, slot.index * effectiveCycleMinutes).toISOString();
                const slotEndsAt = addMinutes(new Date(slotStartsAt), effectiveSlotMinutes * lunchMeta.lunchSlotSpan).toISOString();
                const selectedSlot = !isLunchBreak && selectedSlotKey === slotKey;
                const highlightedSlot = !isLunchBreak && highlightedSlotKeys.includes(slotKey);
                const canDrop = !isLunchBreak && canDropSlotKeys.includes(slotKey);
                const isDropTarget = !isLunchBreak && dropTargetSlotKey === slotKey;
                return (
                  <View
                    key={`${selectedDateKey}-${slot.label}`}
                    style={[styles.slotRow, isLunchBreak ? { minHeight: SLOT_HEIGHT * lunchMeta.lunchSlotSpan } : null]}
                  >
                    <View style={styles.timeRail}>
                      <Text style={styles.timeLabel}>{slot.label}</Text>
                    </View>
                    <Pressable
                      ref={(node) => {
                        if (!node || !onSlotLayout || isLunchBreak) return;
                        requestAnimationFrame(() => {
                          node.measureInWindow((x, pageY, width, height) => {
                            onSlotLayout({
                              key: slotKey,
                              pageY,
                              height,
                              startsAt: slotStartsAt,
                              endsAt: slotEndsAt,
                            });
                          });
                        });
                      }}
                      disabled={isLunchBreak}
                      onPress={
                        isLunchBreak
                          ? undefined
                          : () => onSelectedSlotChange?.({ key: slotKey, startsAt: slotStartsAt, endsAt: slotEndsAt })
                      }
                      style={[
                        styles.slotSurface,
                        isLunchBreak ? { minHeight: SLOT_HEIGHT * lunchMeta.lunchSlotSpan } : null,
                        isLunchBreak ? styles.slotSurfaceLunch : null,
                        selectedSlot ? styles.slotSurfaceSelected : null,
                        highlightedSlot ? styles.slotSurfaceHighlighted : null,
                        canDrop && externalDropActive ? styles.slotSurfaceCanDrop : null,
                        isDropTarget ? styles.slotSurfaceDropTarget : null,
                      ]}
                    >
                      {isLunchBreak ? (
                        <Text style={styles.lunchLabel}>
                          Öğle arası
                          {"\n"}
                          {slot.label} - {formatTime(slotEndsAt)}
                        </Text>
                      ) : slotEvents.length === 0 ? (
                        <View style={styles.slotPlaceholder} />
                      ) : null}
                      {slotEvents.map((event) => (
                        <SchedulerEventCard
                          key={event.id}
                          event={event}
                          currentDayIndex={selectedDay?.index ?? 0}
                          currentSlotIndex={slot.index}
                          weekDays={weekDays}
                          slotCount={slots.length}
                          slotHeight={SLOT_HEIGHT}
                          startMinutes={effectiveStartMinutes}
                          slotMinutes={effectiveSlotMinutes}
                          canDropSlotKeys={canDropSlotKeys}
                          draggable={Boolean(onEventDrop) && event.draggable !== false}
                          onPress={event.onPress}
                          onDrop={onEventDrop}
                        />
                      ))}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </SurfaceCard>
      </Animated.View>
    </View>
  );
}

function AgendaEventRow({
  event,
  timezone,
  onPress,
}: {
  event: WeeklySchedulerEvent;
  timezone: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatTimeRange(event.startsAt, event.endsAt, timezone)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.agendaEvent,
        toneToCardStyle(event.badgeTone),
        pressed ? styles.agendaEventPressed : null,
      ]}
    >
      <View style={styles.agendaTimeRail}>
        <Text style={styles.agendaStartTime}>{formatTime(event.startsAt, timezone)}</Text>
        <Text style={styles.agendaEndTime}>{formatTime(event.endsAt, timezone)}</Text>
      </View>
      <View style={styles.agendaEventBody}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
          {event.badgeLabel ? <StatusBadge label={event.badgeLabel} tone={event.badgeTone || "neutral"} /> : null}
        </View>
        <Text style={styles.eventSubtitle} numberOfLines={2}>{event.subtitle}</Text>
        {event.onAction && event.actionLabel ? (
          <Pressable
            testID={event.actionTestID}
            accessibilityRole="button"
            accessibilityLabel={event.actionLabel}
            hitSlop={6}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              event.onAction?.();
            }}
            style={({ pressed }) => [styles.agendaAction, pressed ? styles.agendaActionPressed : null]}
          >
            {event.actionIcon ? <AppIcon name={event.actionIcon} size="sm" tone="primary" variant="plain" /> : null}
            <Text style={styles.agendaActionLabel}>{event.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function SchedulerEventCard({
  event,
  currentDayIndex,
  currentSlotIndex,
  weekDays,
  slotCount,
  slotHeight,
  startMinutes,
  slotMinutes,
  canDropSlotKeys,
  draggable,
  onPress,
  onDrop,
}: {
  event: WeeklySchedulerEvent;
  currentDayIndex: number;
  currentSlotIndex: number;
  weekDays: WeekDay[];
  slotCount: number;
  slotHeight: number;
  startMinutes: number;
  slotMinutes: number;
  canDropSlotKeys: string[];
  draggable: boolean;
  onPress?: () => void;
  onDrop?: (payload: { event: WeeklySchedulerEvent; startsAt: string; endsAt: string }) => void;
}) {
  const translate = useRef(new Animated.ValueXY()).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          draggable && (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8),
        onPanResponderMove: Animated.event([null, { dx: translate.x, dy: translate.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gestureState) => {
          const dayDelta =
            gestureState.dx > DAY_DRAG_THRESHOLD ? 1 : gestureState.dx < -DAY_DRAG_THRESHOLD ? -1 : 0;
          const slotDelta = Math.round(gestureState.dy / slotHeight);

          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();

          if (!onDrop || (dayDelta === 0 && slotDelta === 0)) return;

          const targetDayIndex = clamp(currentDayIndex + dayDelta, 0, weekDays.length - 1);
          const targetSlotIndex = clamp(currentSlotIndex + slotDelta, 0, slotCount - 1);
          const duration = eventDurationMinutes(event);
          const targetDate = new Date(weekDays[targetDayIndex].date);
          targetDate.setHours(0, 0, 0, 0);
          const dayStart = addMinutes(targetDate, startMinutes);
          const startsAt = addMinutes(dayStart, targetSlotIndex * slotMinutes);
          const endsAt = addMinutes(startsAt, duration);
          const targetSlotKey = `${weekDays[targetDayIndex].key}-${startsAt.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`;

          if (canDropSlotKeys.length > 0 && !canDropSlotKeys.includes(targetSlotKey)) {
            return;
          }

          onDrop({
            event,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          });
        },
      }),
    [
      currentDayIndex,
      currentSlotIndex,
      draggable,
      event,
      onDrop,
      slotCount,
      slotHeight,
      slotMinutes,
      startMinutes,
      translate,
      weekDays,
      canDropSlotKeys,
    ]
  );

  const toneStyle = toneToCardStyle(event.badgeTone);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.eventCard,
          toneStyle,
          draggable ? styles.eventCardDraggable : null,
          { transform: translate.getTranslateTransform() },
        ]}
      >
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {event.badgeLabel ? <StatusBadge label={event.badgeLabel} tone={event.badgeTone || "neutral"} /> : null}
        </View>
        <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
        <Text style={styles.eventMeta}>{formatTimeRange(event.startsAt, event.endsAt)}</Text>
        {draggable ? <Text style={styles.dragHint}>Sürükle ve takvime taşı</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: tokens.spacing.md,
  },
  weekCard: {
    gap: tokens.spacing.sm,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  weekHeaderText: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  weekTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  weekSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  daysRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 8,
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillDisabled: {
    opacity: 0.45,
  },
  dayPillActive: {
    backgroundColor: tokens.colors.primaryStrong,
    borderColor: tokens.colors.primaryStrong,
    ...tokens.shadow.focus,
  },
  dayTitle: {
    color: tokens.colors.text,
    fontSize: 11,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  dayTitleActive: {
    color: tokens.colors.surface,
  },
  daySubtitle: {
    color: tokens.colors.textMuted,
    fontSize: 9,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },
  daySubtitleActive: {
    color: "rgba(255,255,255,0.82)",
  },
  dayCountWrap: {
    alignSelf: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(151,187,156,0.1)",
  },
  dayCountWrapDisabled: {
    backgroundColor: "rgba(107,114,128,0.12)",
  },
  dayCountWrapActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  dayCount: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  dayCountDisabled: {
    color: tokens.colors.textMuted,
  },
  dayCountActive: {
    color: tokens.colors.surface,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  sectionSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  requestRow: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  requestCard: {
    width: 216,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.sm,
    gap: 6,
  },
  requestCardActive: {
    ...tokens.shadow.focus,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  requestDay: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  requestTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  requestText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  requestMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  timelineHeader: {
    gap: tokens.spacing.sm,
  },
  timelineHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  slotStack: {
    gap: 0,
  },
  slotRow: {
    minHeight: SLOT_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
  },
  timeRail: {
    width: 72,
    paddingTop: tokens.spacing.sm,
  },
  timeLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  slotSurface: {
    flex: 1,
    minHeight: SLOT_HEIGHT,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  slotSurfaceSelected: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: "rgba(151,187,156,0.10)",
  },
  slotSurfaceHighlighted: {
    borderColor: tokens.colors.warning,
    backgroundColor: "rgba(245,158,11,0.10)",
  },
  slotSurfaceCanDrop: {
    borderColor: "rgba(245,158,11,0.52)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  slotSurfaceDropTarget: {
    borderColor: tokens.colors.warning,
    borderWidth: 1.5,
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  slotSurfaceLunch: {
    backgroundColor: "#FFF8E8",
    borderColor: "rgba(245,158,11,0.28)",
  },
  timelineCardActive: {
    borderColor: tokens.colors.warning,
    borderWidth: 1,
    backgroundColor: "rgba(245,158,11,0.05)",
  },
  slotPlaceholder: {
    flex: 1,
  },
  lunchLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    paddingTop: tokens.spacing.sm,
  },
  eventCard: {
    gap: 4,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.sm,
  },
  eventCardDraggable: {
    ...tokens.shadow.soft,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  eventTitle: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  eventSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  eventMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  agendaEvent: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  agendaEventPressed: {
    opacity: 0.82,
  },
  agendaTimeRail: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: tokens.colors.border,
    paddingRight: tokens.spacing.sm,
    gap: 2,
  },
  agendaStartTime: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  agendaEndTime: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  agendaEventBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 5,
  },
  agendaAction: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.sm,
    gap: 4,
  },
  agendaActionPressed: {
    opacity: 0.75,
  },
  agendaActionLabel: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  dragHint: {
    color: tokens.colors.warning,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
