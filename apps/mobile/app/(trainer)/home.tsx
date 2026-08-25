import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerScheduleChangeRequestsApi, getTrainerTodayApi } from "@/lib/mobile-api";
import {
  canTrainerBookingCheckIn,
  canTrainerBookingManageSchedule,
  formatTrainerTodayTime,
  sortTrainerTodayBookings,
  type TrainerTodayBooking,
} from "@/lib/trainer-today";
import { bookingStatusLabel } from "@/lib/labels";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { MetricTile } from "@/theme/components/metric-tile";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { buildRoleActionHref, getRoleAction } from "@/lib/role-actions";
import { buildTrainerHomePriorities, type HomePriorityItem } from "@/lib/home-priority";
import { HomePriorityCard } from "@/theme/components/home-priority-card";
import { QueryState } from "@/theme/components/query-state";
import { QUERY_TIMING } from "@/lib/query-performance";

export default function TrainerHomeScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["trainer-today"],
    queryFn: getTrainerTodayApi,
    staleTime: QUERY_TIMING.live,
  });
  const requestsQuery = useQuery({
    queryKey: ["trainer-schedule-change-requests"],
    queryFn: getTrainerScheduleChangeRequestsApi,
    staleTime: QUERY_TIMING.live,
  });

  const bookings = useMemo(() => sortTrainerTodayBookings(query.data?.bookings), [query.data?.bookings]);
  const summary = query.data?.summary || {};
  const checkinCount = Number(summary.checkin_total || 0);
  const remainingCount = bookings.filter(canTrainerBookingManageSchedule).length;
  const groupClassesAction = getRoleAction("TRAINER_GROUP_CLASSES");
  const requestCenterAction = getRoleAction("TRAINER_REQUEST_CENTER");
  const pendingRequestCount = Array.isArray(requestsQuery.data)
    ? requestsQuery.data.filter((item) => String(item.status).toUpperCase() === "PENDING").length
    : 0;
  const priorities = useMemo(() => buildTrainerHomePriorities({ bookings, pendingRequestCount }), [bookings, pendingRequestCount]);

  function openPriority(item: HomePriorityItem) {
    if (!item.route) return;
    router.push({
      pathname: item.route,
      params: { ...item.params, backTo: "/(trainer)/home" },
    } as never);
  }

  function openCheckin(booking: TrainerTodayBooking) {
    router.push({
      pathname: "/(trainer)/checkin",
      params: booking.session_id
        ? { sessionId: String(booking.session_id), backTo: "/(trainer)/home" }
        : { backTo: "/(trainer)/home" },
    } as never);
  }

  function openMember(booking: TrainerTodayBooking) {
    if (!booking.member_id) return;
    router.push({
      pathname: "/(trainer)/members/[id]",
      params: { id: String(booking.member_id), backTo: "/(trainer)/home" },
    } as never);
  }

  function openNotes(booking: TrainerTodayBooking) {
    if (!booking.member_id) return;
    router.push({
      pathname: "/(trainer)/notes",
      params: {
        memberId: String(booking.member_id),
        memberName: String(booking.member_full_name || "Danışan"),
        backTo: "/(trainer)/home",
      },
    } as never);
  }

  function openScheduleActions(booking: TrainerTodayBooking) {
    if (!booking.id) return;
    router.push({
      pathname: "/(trainer)/calendar",
      params: { bookingId: String(booking.id), backTo: "/(trainer)/home" },
    } as never);
  }

  return (
    <AppShell
      testID="trainer-home-screen"
      title="Bugünkü seanslar"
      subtitle="Danışan, not, check-in ve seans değişikliklerini günün akışından yönet."
      icon="today"
      refreshing={query.isRefetching}
      onRefresh={() => void Promise.all([query.refetch(), requestsQuery.refetch()])}
    >
      <View testID="trainer-home-priority-section" style={styles.prioritySection}>
        <View style={styles.priorityHeader}>
          <Text style={styles.sectionTitle}>Sıradaki aksiyonun</Text>
          <Text style={styles.sectionCopy}>Seans ve talepler zamanına göre önem sırasına alınır.</Text>
        </View>
        {query.isLoading && !query.data ? (
          <QueryState mode="loading" title="Günün öncelikleri hazırlanıyor" />
        ) : query.isError && !query.data ? (
          <QueryState mode="error" error={query.error} title="Günün öncelikleri alınamadı" onRetry={() => void query.refetch()} />
        ) : (
          priorities.map((item, index) => (
            <HomePriorityCard
              key={item.key}
              item={item}
              primary={index === 0}
              onPress={item.route ? () => openPriority(item) : undefined}
            />
          ))
        )}
      </View>

      <View style={styles.metricsRow}>
        <MetricTile label="Toplam seans" value={bookings.length} tone="primary" iconName="calendar" />
        <MetricTile label="Bekleyen işlem" value={remainingCount} tone="warning" iconName="clock" />
        <MetricTile label="Check-in" value={checkinCount} tone="success" iconName="checkin" />
      </View>

      <SurfaceCard testID="trainer-home-daily-tools">
        <Text style={styles.sectionTitle}>Günlük araçlar</Text>
        <Text style={styles.sectionCopy}>Takvim ve danışanların dışındaki günlük işlemlere buradan ulaş.</Text>
        <ActionButton testID="trainer-home-group-classes" label={groupClassesAction.label} icon={groupClassesAction.icon} onPress={() => router.push(buildRoleActionHref("TRAINER_GROUP_CLASSES", "/(trainer)/home") as never)} />
        <ActionButton testID="trainer-home-request-center" label={requestCenterAction.label} icon={requestCenterAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("TRAINER_REQUEST_CENTER", "/(trainer)/home") as never)} />
      </SurfaceCard>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>Günün akışı</Text>
          <Text style={styles.sectionCopy}>Seanslar başlangıç saatine göre sıralanır.</Text>
        </View>
        <ActionButton
          testID="trainer-home-qr-button"
          label="QR / kod"
          icon="scan"
          variant="ghost"
          fullWidth={false}
          onPress={() => router.push({ pathname: "/(trainer)/checkin", params: { backTo: "/(trainer)/home" } } as never)}
        />
      </View>

      {query.isLoading ? (
        <EmptyPanel title="Seanslar yükleniyor" description="Bugünkü plan hazırlanıyor." iconName="calendar" iconTone="neutral" />
      ) : bookings.length === 0 ? (
        <EmptyPanel
          title="Bugün planlı seans yok"
          description="Yeni ders taleplerini veya haftanın tamamını takvimden yönetebilirsin."
          iconName="calendar"
          iconTone="warning"
          actionLabel="Takvimi aç"
          onAction={() => router.push("/(trainer)/calendar" as never)}
        />
      ) : (
        <View style={styles.sessionList}>
          {bookings.map((booking, index) => (
            <SessionCard
              key={String(booking.id || `${booking.member_id || "session"}-${index}`)}
              position={index}
              booking={booking}
              onCheckin={() => openCheckin(booking)}
              onMember={() => openMember(booking)}
              onNotes={() => openNotes(booking)}
              onSchedule={() => openScheduleActions(booking)}
            />
          ))}
        </View>
      )}
    </AppShell>
  );
}

function SessionCard({
  position,
  booking,
  onCheckin,
  onMember,
  onNotes,
  onSchedule,
}: {
  position: number;
  booking: TrainerTodayBooking;
  onCheckin: () => void;
  onMember: () => void;
  onNotes: () => void;
  onSchedule: () => void;
}) {
  const checkinAvailable = canTrainerBookingCheckIn(booking);
  const scheduleAvailable = canTrainerBookingManageSchedule(booking);
  const memberAvailable = Boolean(booking.member_id);
  const testPrefix = `trainer-home-session-${position}`;

  return (
    <SurfaceCard testID={testPrefix}>
      <View style={styles.sessionHeader}>
        <View style={styles.timeBlock}>
          <Text style={styles.time}>{formatTrainerTodayTime(booking.starts_at)}</Text>
          <Text style={styles.memberName}>{booking.member_full_name || "Danışan"}</Text>
          <Text style={styles.sessionName}>{booking.session_title || booking.lesson_category_label || booking.lesson_category || "Seans"}</Text>
        </View>
        <StatusBadge label={bookingStatusLabel(booking.status)} tone={scheduleAvailable ? "primary" : "neutral"} />
      </View>

      <View style={styles.sessionActions}>
        <SessionAction testID={`${testPrefix}-checkin`} label="Check-in" icon="checkin" disabled={!checkinAvailable} onPress={onCheckin} />
        <SessionAction testID={`${testPrefix}-member`} label="Danışan" icon="clients" disabled={!memberAvailable} onPress={onMember} />
        <SessionAction testID={`${testPrefix}-note`} label="Not" icon="notes" disabled={!memberAvailable} onPress={onNotes} />
        <SessionAction testID={`${testPrefix}-schedule`} label="Değiştir / iptal" icon="calendar" disabled={!scheduleAvailable} onPress={onSchedule} />
      </View>
    </SurfaceCard>
  );
}

function SessionAction({ testID, label, icon, disabled, onPress }: { testID: string; label: string; icon: AppIconName; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sessionAction, disabled ? styles.actionDisabled : null, pressed && !disabled ? styles.actionPressed : null]}
    >
      <AppIcon name={icon} size="sm" tone="primary" />
      <Text style={styles.sessionActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  prioritySection: { gap: tokens.spacing.sm },
  priorityHeader: { gap: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.spacing.sm },
  sectionHeaderCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  sectionCopy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  sessionList: { gap: tokens.spacing.sm },
  sessionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: tokens.spacing.sm },
  timeBlock: { flex: 1, gap: 2 },
  time: { color: tokens.colors.primaryStrong, fontSize: tokens.font.xl, fontFamily: tokens.fontFamily.bold },
  memberName: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  sessionName: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.regular },
  sessionActions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs },
  sessionAction: {
    minHeight: tokens.touch.comfortable,
    flexGrow: 1,
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  sessionActionLabel: { flexShrink: 1, color: tokens.colors.text, fontSize: tokens.font.xs, textAlign: "center", fontFamily: tokens.fontFamily.semibold },
  actionDisabled: { opacity: 0.45 },
  actionPressed: { transform: [{ scale: 0.98 }], borderColor: tokens.colors.borderStrong },
});
