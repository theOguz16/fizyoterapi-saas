import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAdminClinicSubscriptionApi, startAdminClinicTrialApi, type AdminClinicSubscription } from "@/lib/mobile-api";
import { buildSubscriptionHeadline, formatSubscriptionStatus } from "@/lib/admin-subscription";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { configureRevenueCat, getRevenueCatCurrentPackage, purchaseRevenueCatPackage, restoreRevenueCatPurchases } from "@/lib/revenuecat";
import { SUBSCRIPTION_PRICING, type BillingCycle } from "@/lib/subscription-pricing";
import { useSession } from "@/providers/auth-session";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const PRIVACY_POLICY_URL = "https://fizyoflow.com/privacy-policy";
const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function formatDate(value?: string | null) {
  if (!value) return "Belirlenmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belirlenmedi";
  return date.toLocaleDateString("tr-TR");
}

function getPackageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "RevenueCat paket bilgisi alınamadı. Offering ve mağaza ürün eşleşmesini kontrol et.";
}

function resolvePrimaryAction(subscription?: AdminClinicSubscription | null) {
  if (!subscription) return { label: "Plan bilgisi yükleniyor", icon: "subscription" as AppIconName, disabled: true, action: "NONE" as const };
  if (subscription.review_status !== "PUBLISHED") {
    return { label: "Salon onayı bekleniyor", icon: "approvals" as AppIconName, disabled: true, action: "NONE" as const };
  }
  if (subscription.can_start_trial) {
    return { label: "5 günlük ücretsiz denemeyi başlat", icon: "spark" as AppIconName, disabled: false, action: "TRIAL" as const };
  }
  if (subscription.subscription_status === "ACTIVE") {
    return { label: "Plan aktif", icon: "checkin" as AppIconName, disabled: true, action: "NONE" as const };
  }
  if (subscription.can_purchase_in_app || subscription.recommended_action === "PURCHASE_IN_APP") {
    return { label: "FizyoFlow'yı etkinleştir", icon: "pricing" as AppIconName, disabled: false, action: "PURCHASE" as const };
  }
  return { label: "Satın alma yakında açılacak", icon: "subscription" as AppIconName, disabled: true, action: "NONE" as const };
}

function resolveStatusTone(status?: string): "success" | "warning" | "info" {
  if (status === "ACTIVE" || status === "TRIAL") return "success";
  if (status === "READ_ONLY") return "warning";
  return "info";
}

export default function AdminSubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const { refreshMe, managedClinic } = useSession();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

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
      "Deneme başlatıldı",
      "5 günlük deneme süresi aktif oldu. Sonraki adımda uygulama içi satın alma akışı RevenueCat ile devam edecek."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Deneme başlatılamadı",
      error,
      "Deneme süresi şu anda başlatılamadı."
    );
  },
});

  const subscription = query.data;
  const canPurchase = Boolean(subscription?.can_purchase_in_app);
  const primaryAction = resolvePrimaryAction(subscription);
  const packageProduct = packageQuery.data?.product;
  const selectedPlan = SUBSCRIPTION_PRICING[billingCycle];
  const planName = packageProduct?.title || selectedPlan.label;
  const priceHint = packageQuery.isError
    ? getPackageErrorMessage(packageQuery.error)
    : "Ödeme App Store / Google Play tarafından güvenle tamamlanır.";

  const purchaseMutation = useMutation({
  mutationFn: async () => {
    if (!managedClinic?.id) {
      throw new Error("Salon kimliği bulunamadı.");
    }

    return purchaseRevenueCatPackage(managedClinic.id, billingCycle);
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
      "Satın alma tamamlandı",
      "Mağaza işlemi tamamlandı. Webhook geldikten sonra salon planı aktif duruma geçecek."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Satın alma başarısız",
      error,
      "RevenueCat satın alma akışı tamamlanamadı."
    );
  },
});

  const restoreMutation = useMutation({
  mutationFn: async () => {
    if (!managedClinic?.id) {
      throw new Error("Salon kimliği bulunamadı.");
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
      "Satın almalar yenilendi",
      "RevenueCat restore işlemi tamamlandı. Gerekirse webhook sonrası plan durumu güncellenecek."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Restore başarısız",
      error,
      "Satın alma kayıtları geri yüklenemedi."
    );
  },
});

  const isBusy = startTrialMutation.isPending || purchaseMutation.isPending;

  return (
    <AppShell
      title="FizyoFlow"
      subtitle="Salonunu mobil üyelik, ders ve ekip yönetimiyle büyütmek için planını etkinleştir."
      icon="subscription"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onBack={backTo ? () => router.replace(backTo as never) : undefined}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Plan durumu" value={formatSubscriptionStatus(subscription?.subscription_status)} hint={subscription?.review_status === "PUBLISHED" ? "Satın almaya hazır" : "İnceleme bekleniyor"} icon="subscription" />
        <MetricCard label="Deneme" value={`${subscription?.trial_days_remaining ?? subscription?.trial_days_total ?? 5} gün`} hint={subscription?.subscription_status === "TRIAL" ? "Kalan süre" : "Ücretsiz başlangıç"} icon="calendar" />
      </View>

      <SurfaceCard tone="primary" padding="hero" testID="admin-subscription-hero">
        <View style={styles.heroTop}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="subscription" size="lg" tone="primary" />
          </View>
          <StatusBadge label={formatSubscriptionStatus(subscription?.subscription_status)} tone={resolveStatusTone(subscription?.subscription_status)} />
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SALON YÖNETİM PLANI</Text>
          <Text style={styles.heroTitle}>Salonunu tek uygulamadan yönetmeye devam et</Text>
          <Text style={styles.copy}>{buildSubscriptionHeadline(subscription)}</Text>
        </View>

        <View style={styles.pricePanel}>
          <View style={styles.priceHeader}>
            <View style={styles.priceCopy}>
              <Text style={styles.priceLabel}>{planName}</Text>
              <Text style={styles.priceHintSmall}>Satın alma öncesi aylık veya yıllık planını seç.</Text>
            </View>
            <StatusBadge label="Yıllık 2 ay avantaj" tone="success" />
          </View>

          <View style={styles.planOptions}>
            {(["monthly", "yearly"] as const).map((cycle) => {
              const plan = SUBSCRIPTION_PRICING[cycle];
              const selected = billingCycle === cycle;
              return (
                <Pressable
                  key={cycle}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setBillingCycle(cycle)}
                  style={[styles.planOption, selected ? styles.planOptionSelected : null]}
                >
                  <View style={styles.planOptionTop}>
                    <Text style={styles.planOptionLabel}>{plan.shortLabel}</Text>
                    {selected ? <AppIcon name="checkin" size="sm" tone="success" /> : null}
                  </View>
                  <Text style={styles.priceValue}>{plan.price}</Text>
                  <Text style={styles.planOptionHint}>{cycle === "yearly" ? "349.99 x 10" : "Her ay yenilenir"}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.priceHint, packageQuery.isError ? styles.priceError : null]}>{priceHint}</Text>
          <View style={styles.legalLinks} testID="admin-subscription-legal-links">
            <Text style={styles.legalCopy}>Abonelik otomatik yenilenir. Satın alarak aşağıdaki koşulları kabul edersin.</Text>
            <View style={styles.legalLinkRow}>
              <LegalLink label="Gizlilik Politikası" url={PRIVACY_POLICY_URL} />
              <LegalLink label="Kullanım Koşulları" url={TERMS_OF_USE_URL} />
            </View>
          </View>
        </View>

        <ActionButton
          testID={primaryAction.action === "TRIAL" ? "admin-subscription-start-trial" : "admin-subscription-purchase"}
          label={primaryAction.label}
          icon={primaryAction.icon}
          loading={isBusy}
          disabled={primaryAction.disabled || isBusy || query.isLoading}
          onPress={() => {
            if (primaryAction.action === "TRIAL") {
              startTrialMutation.mutate();
              return;
            }
            if (primaryAction.action === "PURCHASE") {
              purchaseMutation.mutate();
            }
          }}
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Pro ile açılanlar</Text>
        <View style={styles.featureList}>
          <FeatureRow icon="members" title="Üye ve eğitmen yönetimi" description="Aktif üyeler, eğitmen atamaları ve detay profilleri tek panelde kalır." />
          <FeatureRow icon="calendar" title="Ders ve takvim operasyonu" description="Rezervasyon, grup dersi, check-in ve katılım takibi salon düzenini korur." />
          <FeatureRow icon="campaigns" title="Gelir ve büyüme araçları" description="Paketler, kampanyalar, referans akışı ve risk sinyalleri aynı sistemde çalışır." />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Plan bilgisi</Text>
        <View style={styles.metaGrid}>
          <InfoRow label="Salon onayı" value={subscription?.review_status === "PUBLISHED" ? "Tamamlandı" : "Bekleniyor"} />
          <InfoRow label="Deneme başlangıcı" value={formatDate(subscription?.trial_starts_at)} />
          <InfoRow label="Deneme bitişi" value={formatDate(subscription?.trial_ends_at)} />
          <InfoRow label="Satın alma" value={subscription?.purchase_mode === "IN_APP_PURCHASE" ? "Uygulama içi" : "Hazırlanıyor"} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Yardımcı işlemler</Text>
        <ActionButton
          testID="admin-subscription-manage-packages"
          label="Paketleri yönet"
          icon="package"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/(admin)/packages",
              params: { backTo: "/(admin)/subscription", subscriptionBackTo: backTo || "/(admin)/salon" },
            } as never)
          }
        />
        <ActionButton
          testID="admin-subscription-restore"
          label="Satın almaları geri yükle"
          icon="progress"
          variant="ghost"
          loading={restoreMutation.isPending}
          onPress={() => restoreMutation.mutate()}
        />
        {primaryAction.action !== "TRIAL" ? null : (
          <ActionButton
            testID="admin-subscription-purchase-secondary"
            label="Satın alma adımını kontrol et"
            icon="pricing"
            variant="ghost"
            disabled={!canPurchase || purchaseMutation.isPending}
            loading={purchaseMutation.isPending}
            onPress={() => purchaseMutation.mutate()}
          />
        )}
      </SurfaceCard>
    </AppShell>
  );
}

function FeatureRow({ icon, title, description }: { icon: AppIconName; title: string; description: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <AppIcon name={icon} size="sm" tone="primary" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        Linking.openURL(url).catch(() => null);
      }}
    >
      <Text style={styles.legalLink}>{label}</Text>
    </Pressable>
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
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.14)",
  },
  heroCopy: {
    gap: tokens.spacing.xs,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.xxl,
    lineHeight: 30,
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
  pricePanel: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.2)",
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  priceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  priceCopy: {
    flex: 1,
    gap: tokens.spacing.sm,
  },
  priceLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  priceHintSmall: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.semibold,
  },
  planOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  planOption: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  planOptionSelected: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: "#F3FBF6",
  },
  planOptionTop: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.xs,
  },
  planOptionLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  priceValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  planOptionHint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.medium,
  },
  priceHint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  priceError: {
    color: tokens.colors.danger,
    fontFamily: tokens.fontFamily.medium,
  },
  legalLinks: {
    gap: tokens.spacing.xs,
  },
  legalCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  legalLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  legalLink: {
    borderWidth: 1,
    borderColor: "rgba(111,146,116,0.22)",
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(111,146,116,0.08)",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.semibold,
  },
  featureList: {
    gap: tokens.spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  featureDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  metaGrid: {
    gap: tokens.spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  infoLabel: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  infoValue: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "right",
  },
});
