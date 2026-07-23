// Bu sayfa mobil uygulamada admin akisindaki salon ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { getAdminSettingsApi } from "@/lib/mobile-api";
import { useSession } from "@/providers/auth-session";
import { showInfoAlert } from "@/lib/user-feedback";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type ManagedGrowthStatus = "PREPARING" | "WAITING_INFO" | "LIVE" | "OPTIMIZING";

const growthStatusCopy: Record<ManagedGrowthStatus, { label: string; tone: "neutral" | "warning" | "success" | "premium"; copy: string }> = {
  PREPARING: {
    label: "Hazırlanıyor",
    tone: "neutral",
    copy: "Fizyoflow ekibi vitrin metni, görsel düzeni ve SEO alanlarını hazırlıyor.",
  },
  WAITING_INFO: {
    label: "Eksik bilgi bekliyor",
    tone: "warning",
    copy: "Yayına almak için klinikten tamamlanması gereken bilgiler var.",
  },
  LIVE: {
    label: "Yayında",
    tone: "success",
    copy: "Public klinik vitrininiz ziyaretçilere açık ve paylaşılabilir durumda.",
  },
  OPTIMIZING: {
    label: "Optimizasyonda",
    tone: "premium",
    copy: "SEO, Maps, galeri ve CTA akışı Fizyoflow ekibi tarafından iyileştiriliyor.",
  },
};

function normalizeGrowthStatus(value: unknown): ManagedGrowthStatus {
  const status = String(value || "PREPARING").toUpperCase();
  if (status === "WAITING_INFO" || status === "LIVE" || status === "OPTIMIZING") return status;
  return "PREPARING";
}

function publicVitrineUrl(slug?: string | null) {
  const cleanSlug = String(slug || "").trim().toLowerCase();
  return cleanSlug ? `https://${cleanSlug}.fizyoflow.com` : null;
}

export default function AdminSalonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const { logout } = useSession();
  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: getAdminSettingsApi,
  });

  const settings = query.data || {};
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const profile = settings.profile || settings;
  const location = profile.location || {};
  const digitalBrief = profile.digital_brief || {};
  const growthStatus = normalizeGrowthStatus(profile.managed_growth_status);
  const growthCopy = growthStatusCopy[growthStatus];
  const publicUrl = publicVitrineUrl(profile.slug || settings.tenant_slug);
  const missingItems = Array.isArray(digitalBrief.missing_items) ? digitalBrief.missing_items.filter(Boolean) : [];
  const businessHours = resolveBusinessHours(
  [profile.business_hours, location.business_hours],
  {
    locationTimezone: location.timezone,
  }
);
  const hasBusinessHours = businessHours.is_configured;

  return (
    <AppShell
      testID="admin-salon-screen"
      title="Salon ayarları"
      subtitle="Salon profili, çalışma saatleri, plan bilgisi ve yönetim alanlarını buradan düzenle."
      icon="clinic"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onBack={() => router.replace((backTo || "/(admin)/dashboard") as never)}
    >
      <SurfaceCard tone="primary">
        <Text style={styles.title}>{profile.hero_title || settings.tenant_name || "Salon profili"}</Text>
        <Text style={styles.copy}>{profile.about_text || location.address || "Salon profili, iletişim bilgileri ve çalışma düzeni bu alandan yönetilir."}</Text>
        <View style={styles.badges}>
          <StatusBadge label={location.city || "Konum"} tone="info" />
          <StatusBadge label={settings.subscription_status || settings.sübscription_status || "Plan"} tone="premium" />
        </View>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard
          label="Açılış"
          value={hasBusinessHours ? businessHours.start_time || "-" : "Belirlenmedi"}
          hint="Gün başlangıcı"
          icon="clock"
        />

        <MetricCard
          label="Kapanış"
          value={hasBusinessHours ? businessHours.end_time || "-" : "Belirlenmedi"}
          hint="Gün sonu"
          icon="calendar"
        />
      </View>

      <SurfaceCard>
        <Text style={styles.section}>Salon profili</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <AppIcon name="location" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Adres</Text>
              <Text style={styles.summaryValue}>{[location.city, location.district].filter(Boolean).join(" / ") || location.address || "Henüz girilmedi"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="clock" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Ders süresi</Text>
              <Text style={styles.summaryValue}>{hasBusinessHours ? `${businessHours.slot_minutes} dk` : "Henüz ayarlanmadı"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="calendar" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Ders arası mola</Text>
              <Text style={styles.summaryValue}>{hasBusinessHours ? (businessHours.break_duration_minutes ? `${businessHours.break_duration_minutes} dk` : "Molasız") : "Henüz ayarlanmadı"}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard tone={growthStatus === "LIVE" ? "success" : growthStatus === "WAITING_INFO" ? "warning" : "primary"} testID="admin-salon-digital-vitrine">
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.section}>Dijital vitrin</Text>
            <Text style={styles.copy}>{growthCopy.copy}</Text>
          </View>
          <StatusBadge label={growthCopy.label} tone={growthCopy.tone} />
        </View>
        <View style={styles.vitrineUrlBox}>
          <Text style={styles.summaryLabel}>Public link</Text>
          <Text style={[styles.vitrineUrl, !publicUrl ? styles.vitrineUrlPlaceholder : null]}>
            {publicUrl || "URL kodu girilince public link burada oluşacak"}
          </Text>
        </View>
        {missingItems.length ? (
          <View style={styles.missingList}>
            <Text style={styles.summaryLabel}>Eksik bilgiler</Text>
            {missingItems.slice(0, 4).map((item: string) => (
              <Text key={item} style={styles.missingItem}>• {item}</Text>
            ))}
          </View>
        ) : (
          <Text style={styles.copy}>Eksik bilgi görünmüyor. Public önizleme ve paylaşım için linki kullanabilirsiniz.</Text>
        )}
        <View style={styles.actionRow}>
          <ActionButton
            testID="admin-salon-open-public-vitrine"
            label="Public vitrini aç"
            icon="external"
            fullWidth={false}
            disabled={!publicUrl}
            onPress={() => {
              if (!publicUrl) return;
              void Linking.openURL(publicUrl);
            }}
          />
          <ActionButton
            testID="admin-salon-copy-public-vitrine"
            label="Linki kopyala"
            icon="copy"
            variant="ghost"
            fullWidth={false}
            disabled={!publicUrl}
            onPress={async () => {
              if (!publicUrl) return;
              await Clipboard.setStringAsync(publicUrl);
              showInfoAlert("Link kopyalandı", "Klinik vitrini bağlantısı panoya kopyalandı.");
            }}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Yönetim alanları</Text>
        <ActionButton testID="admin-salon-edit-profile" label="Salon profilini düzenle" icon="clinic" onPress={() => router.push({ pathname: "/(admin)/salon-profile", params: { backTo: "/(admin)/salon" } } as never)} />
        <ActionButton testID="admin-salon-working-hours" label="Çalışma saatleri" icon="clock" onPress={() => router.push({ pathname: "/(admin)/working-hours", params: { backTo: "/(admin)/salon" } } as never)} />
        <ActionButton testID="admin-salon-packages" label="Paketler" icon="package" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/packages", params: { backTo: "/(admin)/salon" } } as never)} />
        <ActionButton testID="admin-salon-campaigns" label="Kampanyalar" icon="campaigns" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/campaigns", params: { backTo: "/(admin)/salon" } } as never)} />
        <ActionButton testID="admin-salon-subscription" label="Plan ve abonelik" icon="subscription" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/subscription", params: { backTo: "/(admin)/salon" } } as never)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Salon işlemleri</Text>
        <ActionButton
          label="Salonu kapat"
          icon="risk"
          variant="danger"
          onPress={() => showInfoAlert("Salon kapatma", "Bu işlem şu an mobilde kapalı. Devam etmek için web paneli kullanın.")}
        />
        <ActionButton label="Çıkış yap" icon="logout" variant="ghost" onPress={() => void logout()} />
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  sectionTitleWrap: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
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
    fontFamily: tokens.fontFamily.regular,
    lineHeight: tokens.lineHeight.normal,
  },
  vitrineUrlBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: tokens.spacing.sm + 2,
    gap: 2,
  },
  vitrineUrl: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    lineHeight: tokens.lineHeight.normal,
  },
  vitrineUrlPlaceholder: {
    color: tokens.colors.textMuted,
    fontFamily: tokens.fontFamily.medium,
  },
  missingList: {
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.warningSoft,
    padding: tokens.spacing.sm + 2,
  },
  missingItem: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
    lineHeight: tokens.lineHeight.normal,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryItem: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "center",
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
});
