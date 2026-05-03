import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getAdminClinicSubscriptionApi, startAdminClinicTrialApi } from "@/lib/mobile-api";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { configureRevenueCat, getRevenueCatCurrentPackage, purchaseRevenueCatCurrentPackage, restoreRevenueCatPurchases } from "@/lib/revenuecat";
import { useSession } from "@/providers/auth-session";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

function formatDate(value?: string | null) {
  if (!value) return "Belirlenmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belirlenmedi";
  return date.toLocaleDateString("tr-TR");
}

function statusLabel(value?: string) {
  if (value === "TRIAL") return "Deneme aktif";
  if (value === "ACTIVE") return "Plan aktif";
  if (value === "READ_ONLY") return "Erisim kisitli";
  if (value === "INACTIVE") return "Plan baslamadi";
  return value || "Plan bekleniyor";
}

function buildHeadline(subscription?: { review_status?: string; subscription_status?: string; can_start_trial?: boolean; trial_days_remaining?: number }) {
  if (!subscription) return "Salonunun deneme ve plan akisini buradan yonetebilirsin.";
  if (subscription.review_status !== "PUBLISHED") {
    return "Deneme baslatmadan once salon onayinin tamamlanmasi gerekiyor.";
  }
  if (subscription.subscription_status === "TRIAL") {
    return `Deneme suresi aktif. Kalan sure: ${subscription.trial_days_remaining || 0} gun.`;
  }
  if (subscription.subscription_status === "ACTIVE") {
    return "Salonun ucretli plan uzerinde aktif durumda.";
  }
  if (subscription.subscription_status === "READ_ONLY") {
    return "Deneme bitti. Uygulama ici satin alma ile plani yeniden aktif etmelisin.";
  }
  if (subscription.can_start_trial) {
    return "5 gunluk denemeyi uygulama icinden baslatabilir, ardindan satin alma adimina gecebilirsin.";
  }
  return "Plan durumu guncellenene kadar bu ekrandan akis durumunu takip edebilirsin.";
}

export default function AdminSubscriptionScreen() {
  const router = useRouter();
  const { refreshMe, managedClinic } = useSession();

  const query = useQuery({
    queryKey: ["admin-clinic-subscription"],
    queryFn: getAdminClinicSubscriptionApi,
  });

  const packageQuery = useQuery({
    queryKey: ["admin-clinic-revenuecat-package", managedClinic?.id || ""],
    enabled: Boolean(managedClinic?.id),
    queryFn: async () => getRevenueCatCurrentPackage(String(managedClinic?.id)),
    retry: false,
  });

  useEffect(() => {
    if (!managedClinic?.id) return;
    configureRevenueCat(managedClinic.id).catch(() => null);
  }, [managedClinic?.id]);

  const startTrialMutation = useMutation({
  mutationFn: startAdminClinicTrialApi,

  meta: {
    invalidates: [
      ["admin-clinic-subscription"],
      ["admin-settings"],
      ["me"],
      ["session"],
    ],
  },

  onSuccess: async () => {
    await refreshMe();

    showInfoAlert(
      "Deneme baslatildi",
      "5 gunluk deneme suresi aktif oldu. Sonraki adimda uygulama ici satin alma akisi RevenueCat ile baglanacak."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Deneme baslatilamadi",
      error,
      "Deneme suresi su an baslatilamadi."
    );
  },
});

  const subscription = query.data;
  const canStartTrial = Boolean(subscription?.can_start_trial) && !startTrialMutation.isPending;
  const canPurchase = Boolean(subscription?.can_purchase_in_app);

  const purchaseMutation = useMutation({
  mutationFn: async () => {
    if (!managedClinic?.id) {
      throw new Error("Salon kimligi bulunamadi.");
    }

    return purchaseRevenueCatCurrentPackage(managedClinic.id);
  },

  meta: {
    invalidates: [
      ["admin-clinic-subscription"],
      ["me"],
      ["session"],
    ],
  },

  onSuccess: async () => {
    await refreshMe();

    showInfoAlert(
      "Satin alma tamamlandi",
      "Magaza islemi tamamlandi. Webhook geldikten sonra salon plani aktif duruma gececek."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Satin alma basarisiz",
      error,
      "RevenueCat satin alma akisi tamamlanamadi."
    );
  },
});

  const restoreMutation = useMutation({
  mutationFn: async () => {
    if (!managedClinic?.id) {
      throw new Error("Salon kimligi bulunamadi.");
    }

    return restoreRevenueCatPurchases(managedClinic.id);
  },

  meta: {
    invalidates: [
      ["admin-clinic-subscription"],
      ["me"],
      ["session"],
    ],
  },

  onSuccess: async () => {
    await refreshMe();

    showInfoAlert(
      "Satin alimalar yenilendi",
      "RevenueCat restore islemi tamamlandi. Gerekirse webhook sonrasi plan durumu guncellenecek."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Restore basarisiz",
      error,
      "Satin alma kayitlari geri yuklenemedi."
    );
  },
});

  return (
    <AppShell
      title="Deneme ve plan"
      subtitle="Admin uygulama icinden denemeyi baslatir, sonrasinda satin alma yine uygulama icinden ilerler."
      icon="subscription"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Plan durumu" value={statusLabel(subscription?.subscription_status)} hint={subscription?.review_status === "PUBLISHED" ? "Salon onayi tamam" : "Onay bekleniyor"} icon="subscription" />
        <MetricCard label="Deneme" value={`${subscription?.trial_days_total || 5} gun`} hint={subscription?.subscription_status === "TRIAL" ? `${subscription?.trial_days_remaining || 0} gun kaldi` : "Tek seferlik acilis"} icon="calendar" />
      </View>

      <SurfaceCard tone="primary">
        <Text style={styles.title}>Uygulama ici plan akisi</Text>
        <Text style={styles.copy}>{buildHeadline(subscription)}</Text>
        <View style={styles.metaList}>
          <Text style={styles.metaItem}>Baslangic: {formatDate(subscription?.trial_starts_at)}</Text>
          <Text style={styles.metaItem}>Bitis: {formatDate(subscription?.trial_ends_at)}</Text>
          <Text style={styles.metaItem}>Odeme saglayicisi: RevenueCat</Text>
          <Text style={styles.metaItem}>
            Magaza paketi: {packageQuery.data?.product?.title || packageQuery.data?.product?.identifier || "Henüz yuklenmedi"}
          </Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Su anki isleyis</Text>
        <View style={styles.list}>
          <Text style={styles.item}>1. Salon onaylandiktan sonra deneme otomatik baslamaz.</Text>
          <Text style={styles.item}>2. Admin bu ekrandan 5 gunluk denemeyi kendisi baslatir.</Text>
          <Text style={styles.item}>3. Deneme bitmeden once uygulama ici satin alma ile plan aktiflenir.</Text>
          <Text style={styles.item}>4. Member ve trainer odeme yapmaz; tenant plan durumu herkesin erisimini belirler.</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Aksiyonlar</Text>
        <ActionButton
         label={
         subscription?.subscription_status === "TRIAL"
            ? "Deneme aktif"
            : "5 günlük denemeyi başlat"
        }
          icon="spark"
          onPress={() => startTrialMutation.mutate()}
          loading={startTrialMutation.isPending}
          disabled={!canStartTrial}
        />
        <ActionButton
          label="Uygulama icinden satin al"
          icon="pricing"
          variant="ghost"
          disabled={!canPurchase}
          loading={purchaseMutation.isPending}
          onPress={() => purchaseMutation.mutate()}
        />
        <ActionButton
          label="Satin almalari geri yukle"
          icon="progress"
          variant="ghost"
          loading={restoreMutation.isPending}
          onPress={() => restoreMutation.mutate()}
        />
        <ActionButton label="Paketleri yonet" icon="package" variant="ghost" onPress={() => router.push("/(admin)/packages" as never)} />
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
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
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
  metaList: {
    gap: tokens.spacing.xs,
  },
  metaItem: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  list: {
    gap: tokens.spacing.xs,
  },
  item: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
