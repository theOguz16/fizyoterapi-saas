import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerTodayApi } from "@/lib/mobile-api";
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

export default function TrainerHomeScreen() {
  const router = useRouter();
  const [secondaryActionsVisible, setSecondaryActionsVisible] = useState(false);
  const query = useQuery({
    queryKey: ["trainer-today"],
    queryFn: getTrainerTodayApi,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const bookings = sortTrainerTodayBookings(query.data?.bookings);
  const summary = query.data?.summary || {};
  const checkinCount = Number(summary.checkin_total || 0);
  const remainingCount = bookings.filter(canTrainerBookingManageSchedule).length;

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
      onRefresh={() => void query.refetch()}
      rightAction={
        <ActionButton
          testID="trainer-home-more-actions"
          label={secondaryActionsVisible ? "Kapat" : "Diğer"}
          icon="settings"
          variant="ghost"
          fullWidth={false}
          onPress={() => setSecondaryActionsVisible((visible) => !visible)}
        />
      }
    >
      <View style={styles.metricsRow}>
        <MetricTile label="Toplam seans" value={bookings.length} tone="primary" iconName="calendar" />
        <MetricTile label="Bekleyen işlem" value={remainingCount} tone="warning" iconName="clock" />
        <MetricTile label="Check-in" value={checkinCount} tone="success" iconName="checkin" />
      </View>

      {secondaryActionsVisible ? (
        <SurfaceCard testID="trainer-home-secondary-actions">
          <Text style={styles.sectionTitle}>Diğer araçlar</Text>
          <Text style={styles.sectionCopy}>Günlük seans dışındaki alanlar burada kalır.</Text>
          <View style={styles.quickGrid}>
            <QuickAction testID="trainer-home-calendar" title="Takvimin tamamı" icon="calendar" onPress={() => router.push("/(trainer)/calendar" as never)} />
            <QuickAction testID="trainer-home-clients" title="Danışanlar" icon="clients" onPress={() => router.push("/(trainer)/clients" as never)} />
            <QuickAction testID="trainer-home-group-classes" title="Grup dersleri" icon="dumbbell" onPress={() => router.push({ pathname: "/(trainer)/group-classes", params: { backTo: "/(trainer)/home" } } as never)} />
            <QuickAction testID="trainer-home-packages" title="Paketlerim" icon="package" onPress={() => router.push({ pathname: "/(trainer)/packages", params: { backTo: "/(trainer)/home" } } as never)} />
            <QuickAction testID="trainer-home-trainer-qr" title="Eğitmen QR" icon="qr" onPress={() => router.push({ pathname: "/(trainer)/qr", params: { backTo: "/(trainer)/home" } } as never)} />
            <QuickAction testID="trainer-home-profile" title="Profil" icon="profile" onPress={() => router.push("/(trainer)/profile" as never)} />
          </View>
        </SurfaceCard>
      ) : null}

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

function QuickAction({ title, icon, onPress, testID }: { title: string; icon: AppIconName; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed ? styles.actionPressed : null]}>
      <AppIcon name={icon} size="sm" tone="neutral" />
      <Text style={styles.quickActionLabel}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
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
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs },
  quickAction: {
    minHeight: tokens.touch.comfortable,
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  quickActionLabel: { flex: 1, color: tokens.colors.text, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.medium },
});
