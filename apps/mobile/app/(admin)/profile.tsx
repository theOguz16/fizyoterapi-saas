import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/providers/auth-session";
import { RoleSwitchActions } from "@/components/role-switch-actions";
import { AccountSecurityCard } from "@/components/account-security-card";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, logout } = useSession();
  const personaLabel = (availablePersonas || []).map((role) => {
    if (role === "TRAINER") return "Eğitmen";
    if (role === "ADMIN") return "Yönetici";
    return "Üye";
  }).join(" • ") || "Yönetici";

  return (
    <AppShell title="Profil" subtitle="Salon sahibi hesabın, iletişim bilgilerin ve yönetim kısayolların burada yer alır." icon="profile">
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

      <SurfaceCard>
        <Text style={styles.section}>Hesap özeti</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <AppIcon name="email" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>E-posta</Text>
              <Text style={styles.summaryValue}>{user?.email || "Eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="phone" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Telefon</Text>
              <Text style={styles.summaryValue}>{user?.phone || "Eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="clinic" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Bağlı salon</Text>
              <Text style={styles.summaryValue}>{activeMembership?.tenant_name || "Bağlantı yok"}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <RoleSwitchActions />

      <SurfaceCard>
        <Text style={styles.section}>Hızlı işlemler</Text>
        <ActionButton label="Bildirim merkezi" icon="notifications" onPress={() => router.push({ pathname: "/(admin)/notifications", params: { backTo: "/(admin)/profile" } } as never)} />
        <ActionButton label="Salon QR kodu" icon="qr" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/clinic-qr", params: { backTo: "/(admin)/profile" } } as never)} />
        <ActionButton label="Plan ve fiyatlar" icon="subscription" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/subscription", params: { backTo: "/(admin)/profile" } } as never)} />
        <ActionButton label="Salon ayarları" icon="settings" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/salon", params: { backTo: "/(admin)/profile" } } as never)} />
      </SurfaceCard>

      <AccountSecurityCard backTo="/(admin)/profile" />

      <ActionButton label="Çıkış yap" icon="logout" variant="danger" onPress={() => void logout()} />
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
