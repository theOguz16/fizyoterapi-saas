import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/providers/auth-session";
import { RoleSwitchActions } from "@/components/role-switch-actions";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { buildRoleActionHref, getRoleAction } from "@/lib/role-actions";

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, logout } = useSession();
  const salonAction = getRoleAction("ADMIN_SALON");
  const accountSettingsAction = getRoleAction("SHARED_ACCOUNT_SETTINGS");
  const personaLabel = (availablePersonas || []).map((role) => {
    if (role === "TRAINER") return "Eğitmen";
    if (role === "ADMIN") return "Yönetici";
    return "Üye";
  }).join(" • ") || "Yönetici";

  return (
    <AppShell testID="admin-profile-screen" title="Profil" subtitle="Hesap, rol ve güvenlik işlemlerini buradan yönet." icon="profile">
      <SurfaceCard tone="primary">
        <Text style={styles.title}>{user?.fullName || "Salon sahibi"}</Text>
        <Text style={styles.copy}>{user?.email || "-"}</Text>
        {user?.phone ? <Text style={styles.copy}>{user.phone}</Text> : null}
        <View style={styles.badges}>
          <StatusBadge label="Salon sahibi" tone="info" />
          <StatusBadge label={activeMembership?.tenant_name || "Salon bağlantısı bekleniyor"} tone="premium" />
        </View>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard label="Rol" value="Yönetici" hint={personaLabel} icon="dashboard" />
        <MetricCard label="Salon" value={activeMembership?.tenant_name || "-"} hint="Aktif bağlantı" icon="clinic" />
      </View>

      <RoleSwitchActions />

      <SurfaceCard>
        <Text style={styles.section}>Salon yönetimi</Text>
        <Text style={styles.copy}>Salon bilgileri, çalışma saatleri, paketler, abonelik ve raporlara tek merkezden ulaş.</Text>
        <ActionButton testID="admin-profile-open-salon-management" label={salonAction.label} icon={salonAction.icon} onPress={() => router.push(buildRoleActionHref("ADMIN_SALON", "/(admin)/profile") as never)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Hesap ayarları</Text>
        <Text style={styles.copy}>{accountSettingsAction.description}</Text>
        <ActionButton testID="admin-profile-account-settings" label={accountSettingsAction.label} icon={accountSettingsAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("SHARED_ACCOUNT_SETTINGS", "/(admin)/profile") as never)} />
      </SurfaceCard>

      <ActionButton testID="admin-profile-logout" label="Çıkış yap" icon="logout" variant="ghost" onPress={() => void logout()} />
    </AppShell>
  );
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
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
