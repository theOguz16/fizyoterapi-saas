import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/providers/auth-session";
import { getTrainerBookingFormOptionsApi } from "@/lib/mobile-api";
import { getNotifıcationPreferences, setNotifıcationPreferences, type NotifıcationPreferences } from "@/lib/local-preferences";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ToggleRow } from "@/theme/components/toggle-row";
import { tokens } from "@/theme/tokens";
import { AppIcon } from "@/theme/components/app-icon";

const DEFAULT_PREFS: NotifıcationPreferences = {
  classReminderThreeHours: true,
  classReminderOneHour: true,
  campaignAlerts: true,
  weeklySummary: true,
  packageEndingAlerts: true,
  measurementReminders: true,
};

export default function TrainerProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, membershipStatus, logout } = useSession();
  const [preferences, setPreferences] = useState<NotifıcationPreferences>(DEFAULT_PREFS);
  const { data, isLoading } = useQuery({
    queryKey: ["trainer-form-options"],
    queryFn: getTrainerBookingFormOptionsApi,
  });
  const skills = data?.allowed_categories || [];

  const personaLabel = useMemo(() => {
    const labels = (availablePersonas || []).map((role) => {
      if (role === "MEMBER") return "Üye";
      if (role === "ADMIN") return "Yönetici";
      return "Eğitmen";
    });
    return labels.length > 0 ? labels.join(" • ") : "Eğitmen";
  }, [availablePersonas]);

  useEffect(() => {
    getNotifıcationPreferences().then(setPreferences).catch(() => setPreferences(DEFAULT_PREFS));
  }, []);

  async function updatePreference<K extends keyof NotifıcationPreferences>(key: K, value: NotifıcationPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await setNotifıcationPreferences(next);
  }

  return (
    <AppShell title="Profil" subtitle="Uzmanlıkların, hesap bilgilerin ve eğitmen hesabına ait hızlı işlemler burada yer alır." icon="trainer">
      <SurfaceCard tone="primary">
        <Text style={styles.name}>{user?.fullName || "Eğitmen"}</Text>
        <Text style={styles.copy}>{user?.email || "E-posta eklenmemiş"}</Text>
        {user?.phone ? <Text style={styles.copy}>{user.phone}</Text> : null}
        <View style={styles.row}>
          <StatusBadge label="Eğitmen" tone="info" />
          <StatusBadge label={activeMembership?.tenant_name || "Salon bağlantısı bekleniyor"} tone="premium" />
        </View>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard label="Rol" value="Eğitmen" hint={personaLabel} icon="trainer" />
        <MetricCard label="Salon" value={activeMembership?.tenant_name || "-"} hint={membershipStatus || "Bağlantı durumu"} icon="salon" />
      </View>

      <View style={styles.metricsRow}>
        <MetricCard label="Uzmanlık" value={skills.length || 0} hint="Tanımlı ders kategorisi" icon="spark" />
        <MetricCard label="Bildirim" value={preferences.weeklySummary ? "Açık" : "Kapalı"} hint="Haftalık özet" icon="notifications" />
      </View>
      <SurfaceCard>
        <Text style={styles.section}>Uzmanlık alanları</Text>
        {isLoading ? (
          <Text style={styles.copy}>Uzmanlıklar hazırlanıyor...</Text>
        ) : skills.length > 0 ? (
          <View style={styles.skillsRow}>
            {skills.map((skill: string, index: number) => (
              <StatusBadge key={index} label={skill} tone="info" />
            ))}
          </View>
        ) : (
          <Text style={styles.copy}>Henüz tanımlı bir uzmanlık görünmüyor. Salon yöneticisi ilk kategori eşlemesini yaptığında burada listelenecek.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Hesap özeti</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <AppIcon name="email" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>E-posta</Text>
              <Text style={styles.summaryValue}>{user?.email || "E-posta eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="phone" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Telefon</Text>
              <Text style={styles.summaryValue}>{user?.phone || "Telefon eklenmemiş"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="salon" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Salon</Text>
              <Text style={styles.summaryValue}>{activeMembership?.tenant_name || "Henüz bağlı değil"}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon name="trainer" size="sm" tone="neutral" />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Persona</Text>
              <Text style={styles.summaryValue}>{personaLabel}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Bildirim tercihleri</Text>
        <ToggleRow label="3 saat önce" description="Yaklaşan ders hatırlatması" value={preferences.classReminderThreeHours} onValueChange={(value) => void updatePreference("classReminderThreeHours", value)} />
        <ToggleRow label="1 saat önce" description="Son hazırlık uyarısı" value={preferences.classReminderOneHour} onValueChange={(value) => void updatePreference("classReminderOneHour", value)} />
        <ToggleRow label="Risk ve kampanya sinyalleri" description="Riskli danışan ve aksiyon önerileri" value={preferences.campaignAlerts} onValueChange={(value) => void updatePreference("campaignAlerts", value)} />
        <ToggleRow label="Haftalık özet" description="Kazanç ve ders toplamı" value={preferences.weeklySummary} onValueChange={(value) => void updatePreference("weeklySummary", value)} />
        <ToggleRow label="Ölçüm ve takip" description="Danışan ölçüm ve takip hatırlatmaları" value={preferences.measurementReminders} onValueChange={(value) => void updatePreference("measurementReminders", value)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Kısayollar</Text>
        <ActionButton label="Eğitmen QR kodu" icon="qr" onPress={() => router.push("/(trainer)/qr" as never)} />
        <ActionButton label="Danışanlarımı aç" icon="members" onPress={() => router.push("/(trainer)/clients" as never)} />
        <ActionButton label="Bugünün akışı" icon="today" variant="ghost" onPress={() => router.push("/(trainer)/today" as never)} />
      </SurfaceCard>

      <ActionButton testID="trainer-profile-logout" label="Çıkış yap" icon="logout" variant="danger" onPress={() => void logout()} />
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
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  row: {
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
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
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
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
});
