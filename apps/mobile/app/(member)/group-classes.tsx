import { useMutation, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import {
  getMemberGroupClassWaitlistApi,
  joinMemberGroupClassWaitlistApi,
  leaveMemberGroupClassWaitlistApi,
  leaveMemberGroupClassApi,
  getMemberGroupClassesApi,
  joinMemberGroupClassApi,
} from "@/lib/mobile-api";
import { formatGroupClassDateTime, formatGroupClassPrice, getGroupClassAudienceLabel, getGroupClassDisplayName, getGroupClassScheduleLabel } from "@/lib/group-classes";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyState } from "@/theme/components/empty-state";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

function getJoinTone(state?: string | null) {
  const normalized = String(state || "").toUpperCase();
  if (normalized === "JOINED") return "success" as const;
  if (normalized === "PENDING") return "warning" as const;
  return "info" as const;
}

function getJoinLabel(state?: string | null) {
  const normalized = String(state || "").toUpperCase();
  if (normalized === "JOINED") return "Katıldın";
  if (normalized === "PENDING") return "Onay bekliyor";
  return "Açık";
}

function WaitlistActions({ sessionId, full }: { sessionId: string; full: boolean }) {
  const query = useQuery({
    queryKey: ["member-group-class-waitlist", sessionId],
    queryFn: () => getMemberGroupClassWaitlistApi(sessionId),
    enabled: Boolean(sessionId),
  });
  const join = useMutation({
    mutationFn: () => joinMemberGroupClassWaitlistApi(sessionId),
    onSuccess: () => void query.refetch(),
  });
  const leave = useMutation({
    mutationFn: () => leaveMemberGroupClassWaitlistApi(sessionId),
    onSuccess: () => void query.refetch(),
  });
  const state = query.data;
  if (!full && !state?.joined) return null;

  return (
    <View style={styles.waitlistBox}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.waitlistTitle}>{state?.joined ? `Bekleme sırasında ${state.position || "-"}. kişisin` : "Ders dolu"}</Text>
          <Text style={styles.copy}>{state?.joined ? "Yer açıldığında bildirim alacaksın." : `${state?.count || 0} kişi bekleme listesinde.`}</Text>
        </View>
        <StatusBadge label={state?.joined ? "Sıradasın" : "Bekleme listesi"} tone="warning" />
      </View>
      <ActionButton
        label={state?.joined ? "Bekleme listesinden çık" : "Bekleme listesine gir"}
        icon="notifications"
        variant={state?.joined ? "ghost" : "primary"}
        loading={join.isPending || leave.isPending}
        onPress={() => (state?.joined ? leave.mutate() : join.mutate())}
      />
    </View>
  );
}

export default function MemberGroupClassesScreen() {
  const query = useQuery({
    queryKey: ["member-group-classes"],
    queryFn: getMemberGroupClassesApi,
  });

  const joinMutation = useMutation({
  mutationFn: (id: string) => joinMemberGroupClassApi(id),

  meta: {
  invalidates: [
    ["member-group-classes"],
    ["member-home-group-classes"],
    ["member-home"],
    ["member-home-v2"],
    ["member-bookings"],
    ["member-bookings-calendar"],

    ["trainer-group-classes"],
    ["trainer-bookings"],
    ["trainer-today"],
    ["trainer-today-calendar"],

    ["admin-sessions"],
    ["admin-bookings"],
    ["admin-dashboard"],
    ["admin-dashboard-v2"],
    ["admin-approvals-v2"],
  ],
}
});

  const leaveMutation = useMutation({
  mutationFn: (id: string) => leaveMemberGroupClassApi(id),

  meta: {
  invalidates: [
    ["member-group-classes"],
    ["member-home-group-classes"],
    ["member-home"],
    ["member-home-v2"],
    ["member-bookings"],
    ["member-bookings-calendar"],

    ["trainer-group-classes"],
    ["trainer-bookings"],
    ["trainer-today"],
    ["trainer-today-calendar"],

    ["admin-sessions"],
    ["admin-bookings"],
    ["admin-dashboard"],
    ["admin-dashboard-v2"],
    ["admin-approvals-v2"],
  ],
}
});

  const rows = Array.isArray(query.data) ? query.data : [];

  return (
    <AppShell
      title="Grup dersleri"
      subtitle="Salonundaki aktif grup derslerini incele, uygun olanlara katıl veya talebini geri çek."
      icon="calendar"
      showBackButton
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {rows.length === 0 ? (
        <EmptyState title="Uygun grup dersi yok" description="Sahip olduğun paketlere uygun yeni grup dersleri açıldığında burada listelenecek." icon="calendar" />
      ) : (
        <ScrollPanel maxHeight={620} contentContainerStyle={styles.stack}>
          {rows.map((row: any, index: number) => {
            const joinState = String(row.member_join_state || "OPEN").toUpperCase();
            const isBusy =
              (joinMutation.isPending && joinMutation.variables === row.id) ||
              (leaveMutation.isPending && leaveMutation.variables === row.id);
            const capacity = Number(row.capacity || 0);
            const joinedCount = Number(row.joined_member_count || 0);
            const full = capacity > 0 && joinedCount >= capacity;
            return (
              <SurfaceCard key={row.id || index} tone="primary">
                <View style={styles.header}>
                  <View style={styles.grow}>
                    <Text style={styles.title}>{getGroupClassDisplayName(row) || row.title || "Grup dersi"}</Text>
                    <Text style={styles.copy}>{getGroupClassScheduleLabel(row)}</Text>
                  </View>
                  <StatusBadge label={getJoinLabel(joinState)} tone={getJoinTone(joinState)} />
                </View>
                <Text style={styles.copy}>Saat: {formatGroupClassDateTime(row.starts_at) || "Saat bekleniyor"}</Text>
                <Text style={styles.copy}>Paket: {row.package_title || "Grup paketi"}</Text>
                <Text style={styles.copy}>Ücret: {formatGroupClassPrice(row.price)}</Text>
                <Text style={styles.copy}>Bildirim: {getGroupClassAudienceLabel(row.notification_scope)}</Text>
                <Text style={styles.copy}>Katılım: {joinedCount}/{capacity || "-"}</Text>
                <Text style={styles.copy}>Eğitmen payı: %{Number(row.trainer_commission_rate || 0)}</Text>
                <ActionButton
                  testID={`member-group-class-action-${index}`}
                  label={joinState === "OPEN" ? (full ? "Kontenjan dolu" : "Katılım talebi gönder") : "Kaydı kaldır"}
                  icon="calendar"
                  variant={joinState === "OPEN" ? "primary" : "ghost"}
                  onPress={() => {
                    if (joinState === "OPEN") {
                      joinMutation.mutate(String(row.id));
                      return;
                    }
                    leaveMutation.mutate(String(row.id));
                  }}
                  loading={isBusy}
                  disabled={joinState === "OPEN" && full}
                />
                {joinState === "OPEN" ? <WaitlistActions sessionId={String(row.id)} full={full} /> : null}
              </SurfaceCard>
            );
          })}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: tokens.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  waitlistBox: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.warningSoft,
  },
  waitlistTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
});
