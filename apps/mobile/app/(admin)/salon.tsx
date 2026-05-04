// Bu sayfa mobil uygulamada admin akisindaki salon ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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

export default function AdminSalonScreen() {
  const router = useRouter();
  const { logout } = useSession();
  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: getAdminSettingsApi,
  });

  const settings = query.data || {};
  const profile = settings.profile || settings;
  const location = profile.location || {};
  const businessHours = resolveBusinessHours(
  [profile.business_hours, location.business_hours],
  {
    locationTimezone: location.timezone,
  }
);
  const hasBusinessHours = businessHours.is_configured;

  return (
    <AppShell
      title="Salon ayarları"
      subtitle="Salon profili, çalışma saatleri, plan bilgisi ve yönetim alanlarını buradan düzenle."
      icon="clinic"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onBack={() => router.replace("/(admin)/dashboard" as never)}
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

      <SurfaceCard>
        <Text style={styles.section}>Yönetim alanları</Text>
        <ActionButton label="Salon profilini düzenle" icon="clinic" onPress={() => router.push("/(admin)/salon-profile" as never)} />
        <ActionButton label="Çalışma saatleri" icon="clock" onPress={() => router.push("/(admin)/working-hours" as never)} />
        <ActionButton label="Paketler" icon="package" variant="ghost" onPress={() => router.push("/(admin)/packages" as never)} />
        <ActionButton label="Kampanyalar" icon="campaigns" variant="ghost" onPress={() => router.push("/(admin)/campaigns" as never)} />
        <ActionButton label="Plan ve abonelik" icon="subscription" variant="ghost" onPress={() => router.push("/(admin)/subscription" as never)} />
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

function hasConfiguredBusinessHours(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    start_time?: unknown;
    end_time?: unknown;
    lunch_break_start?: unknown;
    lunch_break_end?: unknown;
    working_days?: unknown;
  };
  if (typeof candidate.start_time === "string" && candidate.start_time.trim()) return true;
  if (typeof candidate.end_time === "string" && candidate.end_time.trim()) return true;
  if (typeof candidate.lunch_break_start === "string" && candidate.lunch_break_start.trim()) return true;
  if (typeof candidate.lunch_break_end === "string" && candidate.lunch_break_end.trim()) return true;
  return Array.isArray(candidate.working_days) && candidate.working_days.length > 0;
}

const styles = StyleSheet.create({
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
