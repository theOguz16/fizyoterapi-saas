// Bu sayfa mobil uygulamada member akisindaki profile ekranini temsil eder.
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/providers/auth-session";
import { RoleSwitchActions } from "@/components/role-switch-actions";
import { AccountSecurityCard } from "@/components/account-security-card";
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from "@/lib/local-preferences";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { ToggleRow } from "@/theme/components/toggle-row";
import { StatusBadge } from "@/theme/components/status-badge";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

const DEFAULT_PREFS: NotificationPreferences = {
  classReminderThreeHours: true,
  classReminderOneHour: true,
  subscriptionTrialFortyEightHours: true,
  subscriptionTrialTwentyFourHours: true,
  subscriptionTrialTwelveHours: true,
  subscriptionTrialFourHours: true,
  campaignAlerts: true,
  weeklySummary: true,
  packageEndingAlerts: true,
  measurementReminders: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

export default function MemberProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, logout } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    getNotificationPreferences().then(setPreferences).catch(() => setPreferences(DEFAULT_PREFS));
  }, []);

  async function updatePreference<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await setNotificationPreferences(next);
  }

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

      {/* 3. HESAP ÖZETİ */}
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
            <AppIcon name="salon" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Bağlı salon</Text>
              <Text style={styles.summaryValue}>{activeMembership?.tenant_name || "Bağlantı yok"}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <RoleSwitchActions />
      {/* 4. HIZLI İŞLEMLER */}
      <SurfaceCard>
        <View style={styles.inlineBetween}>
        <Text style={styles.section}>Üyelik ve işlemler</Text>
          <AppIcon name="qr" size="sm" tone="primary" />
        </View>
        <ActionButton testID="member-profile-open-qr" label="QR Kodumu Göster" icon="qr" onPress={() => router.push({ pathname: "/(member)/qr/fullscreen", params: { backTo: "/(member)/profile" } } as never)} />
        <ActionButton testID="member-profile-open-referrals" label="Arkadaşını Davet Et" icon="referral" variant="ghost" onPress={() => router.push({ pathname: "/(member)/referrals", params: { backTo: "/(member)/profile" } } as never)} />
        <ActionButton testID="member-profile-open-campaigns" label="Kampanyaları Gör" icon="campaigns" variant="ghost" onPress={() => router.push("/(member)/campaigns" as never)} />
        <ActionButton testID="member-profile-open-notification-settings" label="Bildirim Ayarları" icon="notifications" variant="ghost" onPress={() => router.push("/(shared)/notification-settings" as never)} />
      </SurfaceCard>

      {/* 5. HIZLI BİLDİRİM TERCİHLERİ */}
      <SurfaceCard>
        <Text style={styles.section}>Bildirim tercihleri</Text>
        <ToggleRow label="3 saat önce" description="Yaklaşan ders hatırlatması" value={preferences.classReminderThreeHours} onValueChange={(value) => void updatePreference("classReminderThreeHours", value)} />
        <ToggleRow label="1 saat önce" description="Son hazırlık uyarısı" value={preferences.classReminderOneHour} onValueChange={(value) => void updatePreference("classReminderOneHour", value)} />
        <ToggleRow label="Paket bitiyor" description="Kalan hak ve yenileme uyarısı" value={preferences.packageEndingAlerts} onValueChange={(value) => void updatePreference("packageEndingAlerts", value)} />
        <ToggleRow label="Ölçüm zamanı" description="Gelişimini takip etmen için" value={preferences.measurementReminders} onValueChange={(value) => void updatePreference("measurementReminders", value)} />
      </SurfaceCard>

      <AccountSecurityCard backTo="/(member)/profile" />

      {/* 6. TEHLİKELİ ALAN (ÇIKIŞ) */}
      <SurfaceCard>
        <Text style={styles.sectionTitleDanger}>Salon üyeliği işlemleri</Text>
        <Text style={styles.copy}>Salondan ayrılman durumunda aktif paketlerin ve bağlı ders geçmişin salon tarafında pasife düşebilir.</Text>
        {/* Buton tam kırmızı (danger) ve geniş yapıldı */}
        <ActionButton testID="member-profile-leave-salon" label="Salondan Ayrıl" icon="risk" variant="danger" onPress={() => router.push({ pathname: "/(shared)/leave-salon", params: { backTo: "/(member)/profile" } } as never)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Hesap işlemleri</Text>
        <Text style={styles.copyTight}>Oturumu bu cihazdan güvenli şekilde kapatabilirsin.</Text>
        <ActionButton testID="member-profile-logout" label="Çıkış Yap" icon="logout" variant="danger" onPress={() => void logout()} />
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
  sectionTitleDanger: {
    color: tokens.colors.danger,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm, // Butonla arasına ufak boşluk
  },
  copyTight: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.xs,
  },
  
  // Hesap Özeti
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
