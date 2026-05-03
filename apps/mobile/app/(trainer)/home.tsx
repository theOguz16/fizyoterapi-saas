import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerTodayApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

export default function TrainerHomeScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["trainer-home"],
    queryFn: getTrainerTodayApi,
  });

  const todayRows = Array.isArray(query.data?.bookings)
    ? query.data.bookings
    : Array.isArray(query.data?.today_schedule)
      ? query.data.today_schedule
      : [];
  const riskCount = query.data?.risk?.at_risk_count ?? 0;
  const earnings = query.data?.earnings || {};
  const monthIncome = earnings.month_trainer_income ?? earnings.month_total ?? 0;
  const focusItems = [
    { label: "Riskli üye", value: riskCount, tone: "danger" as const, icon: "risk" as const },
    { label: "Aylık gelir", value: `${monthIncome} TL`, tone: "warning" as const, icon: "wallet" as const },
  ];

  return (
    <AppShell
      title="Bugün"
      subtitle="Bugünkü derslerini, danışan akışını ve check-in işlemlerini tek ekrandan yönet."
      icon="trainer"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      rightAction={
        <ActionButton
          testID="trainer-home-qr-button"
          label="QR okut"
          icon="qr"
          fullWidth={false}
          onPress={() => router.push("/(trainer)/checkin" as never)}
        />
      }
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Bugünkü ders" value={todayRows.length} hint="Takvimde planlanan akış" icon="calendar" />
        <MetricCard label="Aylık gelir" value={`${monthIncome} TL`} hint="Bu ayki kazanç özeti" icon="earnings" />
      </View>

      <SurfaceCard tone="primary">
        <Text style={styles.section}>Bugünün odağı</Text>
        <Text style={styles.copy}>İlk bakışta aksiyon gerektiren başlıkları öne çıkarır.</Text>
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

      <SurfaceCard>
        <Text style={styles.section}>Günlük operasyon</Text>
        <Text style={styles.copy}>Bugün en sık kullanacağın alanlara buradan geç.</Text>
        <View style={styles.quickGrid}>
          <QuickAction testID="trainer-home-calendar" title="Takvimim" icon="calendar" onPress={() => router.push("/(trainer)/calendar" as never)} />
          <QuickAction testID="trainer-home-manual-code" title="Yoklama / QR" icon="scan" onPress={() => router.push("/(trainer)/checkin" as never)} />
          <QuickAction testID="trainer-home-qr" title="Eğitmen QR" icon="qr" onPress={() => router.push("/(trainer)/qr" as never)} />
          <QuickAction testID="trainer-home-packages" title="Paketlerim" icon="package" onPress={() => router.push("/(trainer)/packages" as never)} />
          <QuickAction testID="trainer-home-earnings" title="Kazanç" icon="wallet" onPress={() => router.push("/(trainer)/earnings" as never)} />
          <QuickAction testID="trainer-home-clients" title="Danışanlar" icon="members" onPress={() => router.push("/(trainer)/clients" as never)} />
          <QuickAction testID="trainer-home-profile" title="Profil" icon="profile" onPress={() => router.push("/(trainer)/profile" as never)} />
          <QuickAction testID="trainer-home-group-classes" title="Grup Dersleri" icon="dumbbell" onPress={() => router.push("/(trainer)/group-classes" as never)} />
        </View>
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
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  focusList: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
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
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  quickCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 104,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(151,187,156,0.18)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    justifyContent: "center",
    ...tokens.shadow.soft,
  },
  quickCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  quickHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.14)",
  },
  quickTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
});
