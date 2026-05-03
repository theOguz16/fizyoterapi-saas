// Bu sayfa mobil uygulamada shared akışındaki bildirim tercihleri ekranını temsil eder.
// Sistem izni ile uygulama içi tercihleri birlikte göstererek kullanıcıya net durum sunar.
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ToggleRow } from "@/theme/components/toggle-row";
import { ActionButton } from "@/theme/components/action-button";
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";
import { useSession } from "@/providers/auth-session";

const DEFAULT_PREFS: NotificationPreferences = {
  classReminderThreeHours: true,
  classReminderOneHour: true,
  campaignAlerts: true,
  weeklySummary: true,
  packageEndingAlerts: true,
  measurementReminders: true,
};

export default function NotificationSettingsScreen() {
  const { notificationPermissionStatus, requestNotificationPermission, refreshNotificationPermissionStatus } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getNotificationPreferences().then(setPreferences).catch(() => setPreferences(DEFAULT_PREFS));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshNotificationPermissionStatus();
        setError("");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshNotificationPermissionStatus]);

  const pushEnabled = notificationPermissionStatus === "granted";

  async function updatePreference<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await setNotificationPreferences(next);
  }

  const handleEnableNotifications = useCallback(async () => {
    try {
      setPermissionLoading(true);
      setError("");
      const status = await requestNotificationPermission();
      if (status !== "granted") {
        setError("Bildirim izni kapalı kaldı. İstersen cihaz ayarlarından tekrar açabilirsin.");
      }
    } catch {
      setError("Bildirim izni şu anda güncellenemedi. Birkaç saniye sonra tekrar dene.");
    } finally {
      setPermissionLoading(false);
    }
  }, [requestNotificationPermission]);

  return (
    <AppShell title="Bildirim tercihleri" subtitle="Randevu, kampanya, ölçüm ve paket bitiş bildirimlerini cihazında yönet." icon="notifications">
      <View style={styles.metricsRow}>
        <MetricCard label="Sistem izni" value={pushEnabled ? "Açık" : notificationPermissionStatus === "denied" ? "Kapalı" : "Bekliyor"} hint="Cihaz düzeyi" icon="notifications" />
        <MetricCard label="Tercihler" value={Object.values(preferences).filter(Boolean).length + "/6"} hint="Uygulama içi seçim" icon="calendar" />
      </View>

      <SurfaceCard tone={pushEnabled ? "success" : notificationPermissionStatus === "denied" ? "warning" : "primary"}>
        <Text style={styles.title}>{pushEnabled ? "Bildirimler aktif" : notificationPermissionStatus === "denied" ? "Sistem izni kapalı" : "Bildirim izni bekleniyor"}</Text>
        <Text style={styles.copy}>
          {pushEnabled
            ? "Cihazın bildirim almaya hazır. Aşağıdaki anahtarlarla hangi hatırlatmaları görmek istediğini ince ayarlayabilirsin."
            : notificationPermissionStatus === "denied"
              ? "Uygulama içi tercihlerin kayıtlı kalsa da cihazın bildirim göstermiyor. Bu yüzden randevu ve paket uyarıları sana ulaşmaz."
              : "Henüz sistem izni vermedin. İzin verirsen hatırlatma ve özet bildirimleri cihazına düşer."}
        </Text>
        {!pushEnabled ? (
          <View style={styles.actions}>
            {notificationPermissionStatus === "undetermined" ? (
              <ActionButton label="İzni şimdi ver" icon="notifications" onPress={() => void handleEnableNotifications()} loading={permissionLoading} />
            ) : (
              <ActionButton label="Cihaz ayarlarını aç" icon="settings" onPress={() => void Linking.openSettings()} />
            )}
            <ActionButton label="Tercihleri yine de düzenle" icon="spark" variant="ghost" onPress={() => setError("")} />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SurfaceCard>

      <SurfaceCard>
        <ToggleRow
          label="3 saat önce"
          description="Randevu hatırlatması"
          value={preferences.classReminderThreeHours}
          onValueChange={(value) => void updatePreference("classReminderThreeHours", value)}
          disabled={!pushEnabled}
        />
        <ToggleRow
          label="1 saat önce"
          description="Yaklaşan ders uyarısı"
          value={preferences.classReminderOneHour}
          onValueChange={(value) => void updatePreference("classReminderOneHour", value)}
          disabled={!pushEnabled}
        />
        <ToggleRow
          label="Kampanya"
          description="Referans ve indirim sinyalleri"
          value={preferences.campaignAlerts}
          onValueChange={(value) => void updatePreference("campaignAlerts", value)}
          disabled={!pushEnabled}
        />
        <ToggleRow
          label="Haftalık özet"
          description="Ders ve süreklilik özeti"
          value={preferences.weeklySummary}
          onValueChange={(value) => void updatePreference("weeklySummary", value)}
          disabled={!pushEnabled}
        />
        <ToggleRow
          label="Paket bitiyor"
          description="Yenileme uyarıları"
          value={preferences.packageEndingAlerts}
          onValueChange={(value) => void updatePreference("packageEndingAlerts", value)}
          disabled={!pushEnabled}
        />
        <ToggleRow
          label="Ölçüm hatırlatması"
          description="Ölçüm girme ve güncelleme sinyalleri"
          value={preferences.measurementReminders}
          onValueChange={(value) => void updatePreference("measurementReminders", value)}
          disabled={!pushEnabled}
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.title}>Kural</Text>
        <Text style={styles.copy}>İptal hakkı ders saatinden en az 3 saat önceye kadar geçerli kabul edilir. Bu bilgi ders detayında da gösterilir.</Text>
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
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  actions: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
