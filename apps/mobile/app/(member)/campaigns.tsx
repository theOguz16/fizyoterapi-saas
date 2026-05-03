// Bu sayfa mobil uygulamada member akisindaki campaigns ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getMemberHomeApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";
import { buildCampaignSummary } from "@/lib/member-campaigns";

export default function MemberCampaignsScreen() {
  const { data, isRefetching, refetch } = useQuery({ queryKey: ["member-home"], queryFn: getMemberHomeApi });
  const campaigns = data?.campaigns;
  const referrals = data?.referrals;
  const summary = buildCampaignSummary(campaigns, referrals);

  return (
    <AppShell
      title="Kampanyalar"
      subtitle="Referans ve sadakat fırsatlarının güncel özeti."
      icon="campaigns"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      showBackButton
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Aktif referans" value={summary.activeReferralCampaigns} hint="Davet akışı" icon="referral" />
        <MetricCard label="Sadakat" value={summary.activeLoyaltyCampaigns} hint="Ödül kuralı" icon="campaigns" />
      </View>
      <SurfaceCard>
        <Text style={styles.title}>Referans kampanyaları</Text>
        <StatusBadge label="Arkadaşını davet et" tone="info" />
        <Text style={styles.item}>Aktif kural: {summary.activeReferralCampaigns}</Text>
        <Text style={styles.item}>Toplam davet: {summary.totalReferrals}</Text>
        <Text style={styles.item}>Dönüşen: {summary.convertedReferrals}</Text>
        <Text style={styles.item}>Ödüllenen: {summary.rewardedReferrals}</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title}>Sadakat kampanyaları</Text>
        <StatusBadge label="Devamlılık ödülü" tone="success" />
        <Text style={styles.item}>Aktif kural: {summary.activeLoyaltyCampaigns}</Text>
        <Text style={styles.item}>İptal politikası: En az {summary.cancellationHours} saat önce, ücret iadesi yok.</Text>
        <Text style={styles.item}>Bu kurallar paket yenileme ve üyelik sadakati ekranlarında da görünür.</Text>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, fontWeight: "800" },
  item: { color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: 20 },
});
