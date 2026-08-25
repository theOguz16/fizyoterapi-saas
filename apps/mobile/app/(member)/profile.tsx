// Bu sayfa mobil uygulamada member akisindaki profile ekranini temsil eder.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/providers/auth-session";
import { RoleSwitchActions } from "@/components/role-switch-actions";
import { buildRoleActionHref, getRoleAction } from "@/lib/role-actions";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

export default function MemberProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, logout } = useSession();
  const qrAction = getRoleAction("MEMBER_QR");
  const referralsAction = getRoleAction("MEMBER_REFERRALS");
  const campaignsAction = getRoleAction("MEMBER_CAMPAIGNS");
  const accountSettingsAction = getRoleAction("SHARED_ACCOUNT_SETTINGS");

  // Kullanıcının sahip olduğu tüm rolleri listeleme (Eğitmen/Üye)
  const personaLabel = (availablePersonas || []).map((role) => {
    if (role === "TRAINER") return "Eğitmen";
    if (role === "ADMIN") return "Yönetici";
    return "Üye";
  }).join(" • ") || "Üye";

  return (
    <AppShell 
      testID="member-profile-screen"
      title="Profil" 
      subtitle="Hesap bilgilerin, üyelik işlemlerin ve bildirim tercihlerin burada yer alır." 
      icon="profile"
    >
      {/* 1. KAHRAMAN (HERO) KARTI */}
      <SurfaceCard tone="primary">
        <Text style={styles.name}>{user?.fullName || "Üye"}</Text>
        <Text style={styles.copy}>{user?.email || "E-posta tanımlı değil"}</Text>
        {user?.phone ? <Text style={styles.copy}>{user.phone}</Text> : null}
        <View style={styles.row}>
          <StatusBadge label="Üye" tone="info" />
          <StatusBadge label={activeMembership?.tenant_name || "Salon bağlantısı bekleniyor"} tone="premium" />
        </View>
      </SurfaceCard>

      {/* 2. METRİKLER */}
      <View style={styles.metricsRow}>
        <MetricCard label="Rol" value="Üye" hint={personaLabel} icon="profile" />
        <MetricCard label="Salon" value={activeMembership?.tenant_name || "-"} hint={activeMembership ? "Aktif bağlantı" : "Bağlantı yok"} icon="salon" />
      </View>

      <RoleSwitchActions />

      <SurfaceCard>
        <Text style={styles.section}>Üyelik erişimi</Text>
        <Text style={styles.copy}>Salon girişinde kullanacağın üyelik koduna buradan ulaş.</Text>
        <ActionButton testID="member-profile-open-qr" label={qrAction.label} icon={qrAction.icon} onPress={() => router.push(buildRoleActionHref("MEMBER_QR", "/(member)/profile") as never)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Avantajlar</Text>
        <Text style={styles.copy}>Kampanyalarını incele veya arkadaşın için davet kodu oluştur.</Text>
        <ActionButton testID="member-profile-open-campaigns" label={campaignsAction.label} icon={campaignsAction.icon} onPress={() => router.push(buildRoleActionHref("MEMBER_CAMPAIGNS", "/(member)/profile") as never)} />
        <ActionButton testID="member-profile-open-referrals" label={referralsAction.label} icon={referralsAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("MEMBER_REFERRALS", "/(member)/profile") as never)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Hesap ayarları</Text>
        <Text style={styles.copy}>{accountSettingsAction.description}</Text>
        <ActionButton testID="member-profile-account-settings" label={accountSettingsAction.label} icon={accountSettingsAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("SHARED_ACCOUNT_SETTINGS", "/(member)/profile") as never)} />
      </SurfaceCard>

      <ActionButton testID="member-profile-logout" label="Çıkış yap" icon="logout" variant="ghost" onPress={() => void logout()} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  name: {
    color: tokens.colors.text,
    fontSize: tokens.font.xxl,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
});
