// Bu sayfa mobil uygulamada admin akisindaki campaigns ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getAdminCampaignsApi, type AdminCampaign, updateAdminCampaignApi } from "@/lib/mobile-api";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

export default function AdminCampaignsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: getAdminCampaignsApi,
  });
  const statusMutation = useMutation({
  mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
    updateAdminCampaignApi(id, { is_active }),

  meta: {
    invalidates: [["admin-campaigns"], ["admin-settings"]],
  },

  onSuccess: async (_, variables) => {
    await queryClient.invalidateQueries({
      queryKey: ["admin-campaign", variables.id],
    });

    showInfoAlert(
      "Kampanya güncellendi",
      variables.is_active
        ? "Kampanya tekrar aktif edildi."
        : "Kampanya pasif duruma alındı."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Kampanya güncellenemedi",
      error,
      "Kampanya durumu değiştirilemedi. Lütfen tekrar deneyin."
    );
  },
});

  const campaigns = query.data?.campaigns || {};
  const referral = Array.isArray(campaigns.referral_campaigns) ? campaigns.referral_campaigns : [];
  const loyalty = Array.isArray(campaigns.loyalty_campaigns) ? campaigns.loyalty_campaigns : [];
  const items = [...referral, ...loyalty];

  return (
    <AppShell
      testID="admin-campaigns-screen"
      title="Kampanyalar"
      subtitle="Referans ve katılım ödüllerini, hedef kitlesi ve teslimatıyla yönet."
      icon="campaigns"
      rightAction={<ActionButton testID="admin-campaign-new" label="Yeni" icon="spark" fullWidth={false} onPress={() => router.push({ pathname: "/(admin)/campaign-create", params: { backTo: "/(admin)/campaigns" } } as never)} />}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Kampanya" value={items.length} hint="Aktif ve pasif" icon="campaigns" />
        <MetricCard label="Referans" value={referral.length} hint="Davet odakli" icon="referral" />
      </View>

      {items.length === 0 ? (
        <EmptyState title="Henüz kampanya yok" description="İlk kampanyanı oluşturduğunda burada listelenecek." icon="campaigns" />
      ) : (
        <ScrollPanel maxHeight={460}>
          {items.map((item: AdminCampaign, index: number) => (
            <SurfaceCard key={`${item.id || item.reward_label || index}`}>
              <Text style={styles.title}>{item.name || item.reward_label || "Kampanya"}</Text>
              <View style={styles.badges}>
                <StatusBadge label={item.is_active === false ? "Pasif" : "Aktif"} tone={item.is_active === false ? "neutral" : "success"} />
                <StatusBadge label={formatRewardType(item.reward_type)} tone="info" />
              </View>
              <Text style={styles.copy}>
                {item.audience_label || "Tüm aktif üyeler"} · {item.trigger_label || "Koşul tanımlı"}
              </Text>
              <Text style={styles.copy}>Ödül: {item.reward_label || "Ücretsiz grup dersi"} · Alıcı: {item.target_label || "Üye"}</Text>
              <Text style={styles.hint}>{item.fulfillment_label || "Ödül üyenin kredi cüzdanına otomatik eklenir."}</Text>
              <Text style={styles.copy}>Teslim edilen: {item.fulfillment_count || 0} ödül / {item.fulfilled_credits || 0} kredi</Text>
              <View style={styles.actionsRow}>
                <ActionButton
                  testID={`admin-campaign-edit-${index}`}
                  label="Düzenle"
                  icon="notes"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/campaign-create",
                      params: { id: item.id, backTo: "/(admin)/campaigns" },
                    } as never)
                  }
                />
                <ActionButton
                  testID={`admin-campaign-toggle-${index}`}
                  label={item.is_active === false ? "Aktifleştir" : "Pasife al"}
                  icon="campaigns"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => statusMutation.mutate({ id: item.id, is_active: item.is_active === false })}
                  loading={statusMutation.isPending}
                />
              </View>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  hint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
});

function formatRewardType(value?: string | null) {
  switch (value) {
    case "FREE_CLASS":
    case "GROUP_CLASS_CREDIT":
      return "Ücretsiz ders";
    default:
      return "Kural";
  }
}
