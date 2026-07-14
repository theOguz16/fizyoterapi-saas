import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getMemberHomeApi,
  getMemberGroupClassesApi,
  getMemberScheduleChangeRequestsApi,
  getMemberAttendanceHistoryApi,
  joinMemberGroupClassApi,
  leaveMemberGroupClassApi,
  resolveMemberScheduleChangeRequestApi,
  type MemberAttendanceHistoryItem,
} from "@/lib/mobile-api";
import { formatGroupClassPrice, getGroupClassAudienceLabel, getGroupClassDisplayName, getGroupClassScheduleLabel } from "@/lib/group-classes";
import { useSession } from "@/providers/auth-session";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyState } from "@/theme/components/empty-state";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { ScheduleCard } from "@/theme/components/schedule-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSuccessfulAttendance(item: MemberAttendanceHistoryItem) {
  const result = String(item.result || "").toUpperCase();

  return result === "CREDIT_DEDUCTED" || result === "CHECKED_IN" || result === "COMPLETED";
}

function isThisMonth(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function countThisMonthAttendance(rows: MemberAttendanceHistoryItem[]) {
  return rows.filter((item) => {
    const attendanceDate =
      item.created_at ||
      (item as { checked_in_at?: string | null }).checked_in_at ||
      (item as { starts_at?: string | null }).starts_at;

    return isSuccessfulAttendance(item) && isThisMonth(attendanceDate);
  }).length;
}

function formatSimpleDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMetricValue(value: string | number | null | undefined, unit?: string) {
  const numeric = toNumber(value);
  if (numeric === null) return "-";
  const text = numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
  return unit ? `${text} ${unit}` : text;
}

function calculateDiff(latestVal: unknown, prevVal: unknown) {
  const latest = toNumber(latestVal as string | number | null | undefined);
  const prev = toNumber(prevVal as string | number | null | undefined);
  if (latest !== null && prev !== null) return latest - prev;
  return null;
}

function TrendDelta({ diff, unit, invertColors = false }: { diff: number | null | undefined; unit: string; invertColors?: boolean }) {
  if (diff === null || diff === undefined) return null;

  if (diff === 0) {
    return (
      <View style={styles.trendRow}>
        <Text style={styles.sparkDeltaNeutral}>- Sabit kaldı</Text>
      </View>
    );
  }

  const isUp = diff > 0;
  const isGood = invertColors ? !isUp : isUp;

  return (
    <View style={styles.trendRow}>
      <Text style={[styles.sparkDelta, isGood ? styles.sparkDeltaSuccess : styles.sparkDeltaDanger]}>
        {isUp ? "↑" : "↓"} {Math.abs(diff).toFixed(1)} {unit}
      </Text>
    </View>
  );
}

export default function MemberHomeScreen() {
  const router = useRouter();
  const { activeMembership, user } = useSession();

  const query = useQuery({
    queryKey: ["member-home"],
    queryFn: getMemberHomeApi,
  });

  const attendanceHistoryQuery = useQuery({
    queryKey: ["member-attendance-history"],
    queryFn: getMemberAttendanceHistoryApi,
  });

  const scheduleRequestsQuery = useQuery({
    queryKey: ["member-schedule-change-requests"],
    queryFn: getMemberScheduleChangeRequestsApi,
  });
  const groupClassesQuery = useQuery({
    queryKey: ["member-home-group-classes"],
    queryFn: getMemberGroupClassesApi,
    enabled: Boolean(activeMembership?.tenant_slug),
  });

  const data = query.data;

  const memberIdentity = activeMembership?.linked_user_id || user?.accountId || user?.id || null;
  const usage = data?.lesson_usage || {};
  const nextBooking = Array.isArray(data?.upcoming_bookings) ? data.upcoming_bookings[0] : null;

  const attendanceHistoryPayload = attendanceHistoryQuery.data as
  | MemberAttendanceHistoryItem[]
  | { data?: MemberAttendanceHistoryItem[] }
  | undefined;

  const attendanceHistory: MemberAttendanceHistoryItem[] = Array.isArray(attendanceHistoryPayload)
    ? attendanceHistoryPayload
    : Array.isArray(attendanceHistoryPayload?.data)
      ? attendanceHistoryPayload.data
      : [];

    const apiMonthlyCount = Number(usage.attended_this_month ?? usage.monthly_attendance ?? 0);
    const historyMonthlyCount = countThisMonthAttendance(attendanceHistory);

    const monthlyCount = Math.max(apiMonthlyCount, historyMonthlyCount);
    const hasPending = Boolean(data?.application?.status) || Boolean(data?.pending_request);

    const pendingScheduleRequests = Array.isArray(scheduleRequestsQuery.data)
      ? scheduleRequestsQuery.data.filter((item) => String(item.status).toUpperCase() === "PENDING" && (!memberIdentity || String(item.member_id) === String(memberIdentity)))
      : [];

    const approveMutation = useMutation({
      mutationFn: (id: string) =>
        resolveMemberScheduleChangeRequestApi(id, "APPROVE"),

  meta: {
  invalidates: [
    ["member-schedule-change-requests"],
    ["member-bookings"],
    ["member-bookings-calendar"],
    ["member-home"],
    ["member-home-v2"],

    ["trainer-bookings"],
    ["trainer-today"],
    ["trainer-today-calendar"],

    ["admin-bookings"],
    ["admin-dashboard"],
    ["admin-dashboard-v2"],
    ["admin-settings-calendar"],
  ],
}
});

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      resolveMemberScheduleChangeRequestApi(id, "REJECT"),

    meta: {
      invalidates: [
        ["member-schedule-change-requests"],
        ["member-bookings"],
        ["member-bookings-calendar"],
        ["member-home"],
        ["member-home-v2"],

        ["trainer-bookings"],
        ["trainer-today"],
        ["trainer-today-calendar"],

        ["admin-bookings"],
        ["admin-dashboard"],
        ["admin-dashboard-v2"],
        ["admin-settings-calendar"],
      ],
    }
  });

 const joinGroupClassMutation = useMutation({
  mutationFn: (row: any) => {
    const joinState = String(row.member_join_state || "OPEN").toUpperCase();

    if (joinState === "OPEN") {
      return joinMemberGroupClassApi(String(row.id || row.group_class_id || ""));
    }

    return leaveMemberGroupClassApi(String(row.id || row.group_class_id || ""));
  },

  meta: {
  invalidates: [
    ["member-schedule-change-requests"],
    ["member-bookings"],
    ["member-bookings-calendar"],
    ["member-home"],
    ["member-home-v2"],

    ["trainer-bookings"],
    ["trainer-today"],
    ["trainer-today-calendar"],

    ["admin-bookings"],
    ["admin-dashboard"],
    ["admin-dashboard-v2"],
    ["admin-settings-calendar"],
  ],
}
});

  const resolvedFullName = String(data?.member?.full_name || user?.fullName || "").trim();
  const firstName = resolvedFullName ? resolvedFullName.split(/\s+/)[0] || "" : "";
  const groupClassRows = Array.isArray(groupClassesQuery.data) ? groupClassesQuery.data : [];
  const homeGroupClasses = groupClassRows.slice(0, 12);
  const latestMeasurement = data?.latest_measurement || data?.latest_meaşurement;
  const previousMeasurement = data?.previous_measurement;
  const weightDiff = calculateDiff(latestMeasurement?.weight_kg, previousMeasurement?.weight_kg);
  const fatDiff = calculateDiff(latestMeasurement?.fat_percent, previousMeasurement?.fat_percent);
  const muscleDiff = calculateDiff(
    latestMeasurement?.muscle_kg ?? latestMeasurement?.muscle_percent,
    previousMeasurement?.muscle_kg ?? previousMeasurement?.muscle_percent
  );
  const heightDiff = calculateDiff(latestMeasurement?.height_cm, previousMeasurement?.height_cm);
  const focusItems = [
    { label: "Aktif paket", value: data?.packages?.active_package_count ?? 0, tone: "warning" as const, icon: "package" as const },
    { label: "Onay bekleyen", value: pendingScheduleRequests.length, tone: "warning" as const, icon: "approvals" as const },
  ];

  return (
    <AppShell
      testID="member-home-screen"
      title={firstName ? `Merhaba ${firstName}` : "Merhaba"}
      subtitle="Sonraki dersin, kalan hakların, taleplerin ve günlük ilerleme özetin tek ekranda."
      icon="home"
      refreshing={query.isRefetching || attendanceHistoryQuery.isRefetching}
        onRefresh={() => {
          void Promise.all([query.refetch(), attendanceHistoryQuery.refetch()]);
        }}
      rightAction={
        <ActionButton
          testID="member-home-profile-button"
          label="Profil"
          icon="profile"
          variant="ghost"
          fullWidth={false}
          onPress={() => router.push("/(member)/profile" as never)}
        />
      }
    >
      {pendingScheduleRequests.length > 0 ? (
        <ScrollPanel maxHeight={320}>
          {pendingScheduleRequests.map((request) => (
            <SurfaceCard key={request.id} tone="warning">
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Saat değişikliği onayı</Text>
                <StatusBadge label="Yanıt bekleniyor" tone="warning" />
              </View>
              <Text style={styles.copy}>Eğitmenin {request.session_title || "ders"} için yeni saat önerdi.</Text>
              <Text style={styles.copy}>Mevcut: {formatDate(request.current_starts_at)}</Text>
              <Text style={styles.copy}>Önerilen: {formatDate(request.proposed_starts_at)}</Text>
              <View style={styles.actionRow}>
                <ActionButton label="Onayla" icon="calendar" onPress={() => approveMutation.mutate(request.id)} loading={approveMutation.isPending} />
                <ActionButton label="Reddet" icon="risk" variant="ghost" onPress={() => rejectMutation.mutate(request.id)} loading={rejectMutation.isPending} />
              </View>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      ) : null}

      {hasPending ? (
        <SurfaceCard tone="warning">
          <StatusBadge label="Onay bekliyor" tone="warning" />
          <Text style={styles.copy}>Talebin veya ödeme sürecin devam ediyor. Güncellemeler profil ve bildirimlerde görünecek.</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.metricsRow}>
        <MetricCard label="Kalan hak" value={usage.remaining_total_credits ?? 0} hint="Kullanılabilir toplam kredi" icon="ticket" />
        <MetricCard label="Bu ay katılım" value={monthlyCount} hint="Ay içi ders ritmi" icon="calendar" />
      </View>

      <SurfaceCard tone="primary">
        <Text style={styles.sectionTitle}>Bugünün odağı</Text>
        <Text style={styles.copy}>İlk bakışta aksiyon gerektiren üyelik başlıklarını gösterir.</Text>
        <View style={styles.focusList}>
          {focusItems.map((item) => (
            <View key={item.label} style={styles.focusItem}>
              <AppIcon name={item.icon} size="sm" tone={item.tone} />
              <View style={styles.focusCopy}>
                <Text style={styles.focusLabel}>{item.label}</Text>
                <Text style={styles.focusValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      {nextBooking ? (
        <ScheduleCard
          title={nextBooking.session_title || nextBooking.lesson_category_label || "Yaklaşan ders"}
          subtitle={`${nextBooking.trainer_full_name || "Eğitmen belirlenecek"} • ${nextBooking.package_name || nextBooking.package_title || "Paket"}`}
          timeLabel={formatDate(nextBooking.starts_at)}
          badge={{ label: "Sonraki ders", tone: "info" }}
          onPress={() =>
            router.push({
              pathname: "/(member)/booking/[id]",
              params: { id: nextBooking.id, backTo: "/(member)/home" },
            } as never)
          }
        />
      ) : (
        <EmptyState title="Planlanmış dersin yok" description="Yeni planlama yaptığında burada ilk olarak görünecek." icon="calendar" />
      )}

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <View style={styles.grow}>
            <Text style={styles.sectionTitle}>Grup dersleri</Text>
            <Text style={styles.copy}>Kaydırarak diğer grup derslerini gör, istediklerine katıl.</Text>
          </View>
          <ActionButton label="Tümü" icon="calendar" variant="ghost" fullWidth={false} onPress={() => router.push({ pathname: "/(member)/group-classes", params: { backTo: "/(member)/home" } } as never)} />
        </View>
        {homeGroupClasses.length === 0 ? (
          <EmptyState title="Aktif grup dersi yok" description="Trainer yeni grup dersi açtığında burada slider olarak göreceksin." icon="calendar" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupSlider}>
            {homeGroupClasses.map((row: any, index: number) => (
              <SurfaceCard key={`${row.group_class_id || row.starts_at}-${index}`} tone="primary" style={styles.groupSlide}>
                <Text style={styles.groupTitle}>{getGroupClassDisplayName(row) || row.label || "Grup dersi"}</Text>
                <Text style={styles.copy}>{row.weekday_label || ""} • {row.time_range_label || ""}</Text>
                <Text style={styles.copy}>Plan: {getGroupClassScheduleLabel(row)}</Text>
                <Text style={styles.copy}>Ücret: {formatGroupClassPrice(row.price)}</Text>
                <Text style={styles.copy}>Bildirim: {getGroupClassAudienceLabel(row.notification_scope)}</Text>
                <Text style={styles.copy}>Kontenjan: {row.joined_member_count || 0}/{row.capacity || "-"}</Text>
                <ActionButton
                  testID={`member-home-group-class-join-${index}`}
                  label={String(row.member_join_state || "OPEN").toUpperCase() === "OPEN" ? "Katıl" : "Kaydı kaldır"}
                  icon="calendar"
                  onPress={() => joinGroupClassMutation.mutate(row)}
                  loading={joinGroupClassMutation.isPending}
                />
              </SurfaceCard>
            ))}
          </ScrollView>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Günlük operasyon</Text>
        <Text style={styles.copy}>İhtiyacın olan menülere buradan hızlıca ulaş.</Text>
        <View style={styles.quickGrid}>
          <QuickAction testID="member-home-package" title="Paketim" icon="package" onPress={() => router.push("/(member)/package" as never)} />
          <QuickAction testID="member-home-calendar" title="Takvim" icon="calendar" onPress={() => router.push("/(member)/calendar" as never)} />
          <QuickAction testID="member-home-measurements" title="Ölçümler" icon="measurements" onPress={() => router.push("/(member)/measurements" as never)} />
          <QuickAction testID="member-home-profile" title="Profil" icon="profile" onPress={() => router.push("/(member)/profile" as never)} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son ölçüm özeti</Text>
          <ActionButton testID="member-home-measurements-all" label="Tümü" icon="measurements" variant="ghost" fullWidth={false} onPress={() => router.push("/(member)/measurements" as never)} />
        </View>

        {latestMeasurement ? (
          <>
            <View style={styles.sparkGrid}>
              <View style={styles.sparkCard}>
                <View style={styles.sparkHeader}>
                  <Text style={styles.sparkLabel}>Kilo</Text>
                  <AppIcon name="weight" size="sm" tone="neutral" />
                </View>
                <View style={styles.sparkBody}>
                  <Text style={styles.sparkValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMetricValue(latestMeasurement.weight_kg, "kg")}
                  </Text>
                  <TrendDelta diff={weightDiff} unit="kg" invertColors />
                </View>
              </View>

              <View style={styles.sparkCard}>
                <View style={styles.sparkHeader}>
                  <Text style={styles.sparkLabel}>Yağ oranı</Text>
                  <AppIcon name="droplets" size="sm" tone="neutral" />
                </View>
                <View style={styles.sparkBody}>
                  <Text style={styles.sparkValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMetricValue(latestMeasurement.fat_percent, "%")}
                  </Text>
                  <TrendDelta diff={fatDiff} unit="%" invertColors />
                </View>
              </View>

              <View style={styles.sparkCard}>
                <View style={styles.sparkHeader}>
                  <Text style={styles.sparkLabel}>Kas kütlesi</Text>
                  <AppIcon name="dumbbell" size="sm" tone="neutral" />
                </View>
                <View style={styles.sparkBody}>
                  <Text style={styles.sparkValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMetricValue(latestMeasurement.muscle_kg ?? latestMeasurement.muscle_percent, "kg")}
                  </Text>
                  <TrendDelta diff={muscleDiff} unit="kg" />
                </View>
              </View>

              <View style={styles.sparkCard}>
                <View style={styles.sparkHeader}>
                  <Text style={styles.sparkLabel}>Boy</Text>
                  <AppIcon name="ruler" size="sm" tone="neutral" />
                </View>
                <View style={styles.sparkBody}>
                  <Text style={styles.sparkValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMetricValue(latestMeasurement.height_cm, "cm")}
                  </Text>
                  <TrendDelta diff={heightDiff} unit="cm" />
                </View>
              </View>
            </View>
            <Text style={styles.hint}>Son güncelleme: {formatSimpleDate(latestMeasurement.measured_at || latestMeasurement.meaşured_at)}</Text>
          </>
        ) : (
          <EmptyState title="Ölçüm yok" description="İlk ölçümünü eklediğinde burada trend özetlerini göreceksin." icon="measurements" />
        )}
      </SurfaceCard>

      <SurfaceCard tone="primary">
        <View style={styles.referralHeader}>
          <View style={styles.grow}>
            <Text style={styles.sectionTitle}>Birlikte daha güçlü</Text>
            <Text style={styles.copy}>Arkadaşını davet et, ikiniz de antrenman veya hediye kullanım hakkı kazanın.</Text>
          </View>
          <View style={styles.giftIconWrap}>
            <AppIcon name="gift" size="md" tone="primary" />
          </View>
        </View>
        <ActionButton label="Arkadaşını davet et" icon="referral" onPress={() => router.push({ pathname: "/(member)/referrals", params: { backTo: "/(member)/home" } } as never)} />
      </SurfaceCard>
    </AppShell>
  );
}

function QuickAction({ title, icon, onPress, testID }: { title: string; icon: AppIconName; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed ? styles.quickCardPressed : null]}>
      <View style={styles.quickHeader}>
        <View style={styles.quickIconWrap}>
          <AppIcon name={icon} size="md" tone="primary" />
        </View>
        <AppIcon name="arrow-right" size="sm" tone="neutral" />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.spacing.sm, marginBottom: 4 },
  sectionTitle: { color: tokens.colors.text, fontSize: tokens.font.lg, fontFamily: tokens.fontFamily.semibold, flex: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  hint: { color: tokens.colors.primaryStrong, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.medium, marginTop: 8 },
  grow: { flex: 1, gap: 4 },
  focusList: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  focusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  focusCopy: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  focusLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  focusValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  sparkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  sparkCard: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sparkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sparkLabel: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.medium },
  sparkBody: { gap: 4 },
  sparkValue: { color: tokens.colors.text, fontSize: tokens.font.xl, fontFamily: tokens.fontFamily.bold },
  trendRow: { flexDirection: "row", alignItems: "center" },
  sparkDelta: { fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.bold },
  sparkDeltaSuccess: { color: tokens.colors.success },
  sparkDeltaDanger: { color: tokens.colors.danger },
  sparkDeltaNeutral: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.medium },
  groupSlider: { gap: tokens.spacing.sm, paddingTop: tokens.spacing.sm },
  groupSlide: { width: 272, gap: tokens.spacing.xs },
  groupTitle: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.bold },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  quickCard: { flexGrow: 1, flexBasis: "47%", minHeight: 104, borderRadius: tokens.radius.lg, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.88)", borderColor: "rgba(151,187,156,0.18)", padding: tokens.spacing.md, gap: tokens.spacing.sm, justifyContent: "center", ...tokens.shadow.soft },
  quickCardPressed: { transform: [{ scale: 0.98 }] },
  quickHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(151,187,156,0.14)" },
  quickTitle: { color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.semibold },
  referralHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.spacing.md, marginBottom: tokens.spacing.sm },
  giftIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(245,158,11,0.15)", justifyContent: "center", alignItems: "center" },
});
