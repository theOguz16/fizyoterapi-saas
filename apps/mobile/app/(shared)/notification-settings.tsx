// Bu sayfa mobil uygulamada shared akışındaki bildirim tercihleri ekranını temsil eder.
// Sistem izni ile uygulama içi tercihleri birlikte göstererek kullanıcıya net durum sunar.
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ToggleRow } from "@/theme/components/toggle-row";
import { ActionButton } from "@/theme/components/action-button";
import { FormField } from "@/theme/components/form-field";
import { getMobileNotificationPreferencesApi, updateMobileNotificationPreferencesApi, type MobileNotificationPreferences } from "@/lib/mobile-api";
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";
import { useSession } from "@/providers/auth-session";

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

function fromApiPreferences(value: MobileNotificationPreferences | null | undefined): NotificationPreferences {
  if (!value) return DEFAULT_PREFS;
  return {
    classReminderThreeHours: value.class_reminders?.three_hours ?? DEFAULT_PREFS.classReminderThreeHours,
    classReminderOneHour: value.class_reminders?.one_hour ?? DEFAULT_PREFS.classReminderOneHour,
    subscriptionTrialFortyEightHours: value.subscription_trial_reminders?.forty_eight_hours ?? DEFAULT_PREFS.subscriptionTrialFortyEightHours,
    subscriptionTrialTwentyFourHours: value.subscription_trial_reminders?.twenty_four_hours ?? DEFAULT_PREFS.subscriptionTrialTwentyFourHours,
    subscriptionTrialTwelveHours: value.subscription_trial_reminders?.twelve_hours ?? DEFAULT_PREFS.subscriptionTrialTwelveHours,
    subscriptionTrialFourHours: value.subscription_trial_reminders?.four_hours ?? DEFAULT_PREFS.subscriptionTrialFourHours,
    campaignAlerts: value.campaign_alerts ?? DEFAULT_PREFS.campaignAlerts,
    weeklySummary: value.weekly_summary ?? DEFAULT_PREFS.weeklySummary,
    packageEndingAlerts: value.package_expiry_reminders ?? DEFAULT_PREFS.packageEndingAlerts,
    measurementReminders: value.measurement_reminders ?? DEFAULT_PREFS.measurementReminders,
    quietHoursEnabled: value.quiet_hours?.enabled ?? DEFAULT_PREFS.quietHoursEnabled,
    quietHoursStart: value.quiet_hours?.start ?? DEFAULT_PREFS.quietHoursStart,
    quietHoursEnd: value.quiet_hours?.end ?? DEFAULT_PREFS.quietHoursEnd,
  };
}

function toApiPreferences(value: NotificationPreferences): MobileNotificationPreferences {
  return {
    class_reminders: {
      three_hours: value.classReminderThreeHours,
      one_hour: value.classReminderOneHour,
    },
    subscription_trial_reminders: {
      forty_eight_hours: value.subscriptionTrialFortyEightHours,
      twenty_four_hours: value.subscriptionTrialTwentyFourHours,
      twelve_hours: value.subscriptionTrialTwelveHours,
      four_hours: value.subscriptionTrialFourHours,
    },
    package_expiry_reminders: value.packageEndingAlerts,
    campaign_alerts: value.campaignAlerts,
    weekly_summary: value.weeklySummary,
    measurement_reminders: value.measurementReminders,
    quiet_hours: {
      enabled: value.quietHoursEnabled,
      start: value.quietHoursStart,
      end: value.quietHoursEnd,
    },
  };
}

export default function NotificationSettingsScreen() {
  const { notificationPermissionStatus, requestNotificationPermission, refreshNotificationPermissionStatus } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [syncingPreferences, setSyncingPreferences] = useState(false);
  const [allowPreferenceEditing, setAllowPreferenceEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadPreferences() {
      try {
        const [localPrefs, remotePrefs] = await Promise.all([
          getNotificationPreferences().catch(() => DEFAULT_PREFS),
          getMobileNotificationPreferencesApi().catch(() => null),
        ]);
        if (!mounted) return;
        const next = remotePrefs ? fromApiPreferences(remotePrefs) : localPrefs;
        setPreferences(next);
        await setNotificationPreferences(next);
      } catch {
        if (mounted) setPreferences(DEFAULT_PREFS);
      }
    }

    void loadPreferences();
    return () => {
      mounted = false;
    };
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
  const canEditPreferences = pushEnabled || allowPreferenceEditing;

  async function updatePreference<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await setNotificationPreferences(next);
    try {
      setSyncingPreferences(true);
      await updateMobileNotificationPreferencesApi(toApiPreferences(next));
    } catch {
      setError("Tercihin cihazında kaydedildi. Sunucu eşitlemesi için bağlantı gelince tekrar deneyebilirsin.");
    } finally {
      setSyncingPreferences(false);
    }
  }

  function commitQuietHour(key: "quietHoursStart" | "quietHoursEnd", value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      setError("Sessiz saatleri 24 saat formatında gir. Örnek: 22:00");
      setPreferences((current) => ({ ...current, [key]: key === "quietHoursStart" ? "22:00" : "08:00" }));
      return;
    }
    setError("");
    void updatePreference(key, value);
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
    <AppShell testID="notification-settings-screen" title="Bildirim tercihleri" subtitle="Randevu, kampanya, ölçüm ve paket bitiş bildirimlerini cihazında yönet." icon="notifications" showBackButton>
      <View style={styles.metricsRow}>
        <MetricCard label="Sistem izni" value={pushEnabled ? "Açık" : notificationPermissionStatus === "denied" ? "Kapalı" : "Bekliyor"} hint="Cihaz düzeyi" icon="notifications" />
        <MetricCard label="Tercihler" value={Object.values(preferences).filter((item) => item === true).length + "/10"} hint={syncingPreferences ? "Eşitleniyor" : "Sunucu eşli"} icon="calendar" />
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
            <ActionButton
              testID="notification-edit-without-permission"
              label="Tercihleri yine de düzenle"
              icon="spark"
              variant="ghost"
              onPress={() => {
                setAllowPreferenceEditing(true);
                setError("");
              }}
            />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SurfaceCard>

      <SurfaceCard>
        <ToggleRow
          testID="notification-pref-class-three-hours"
          label="3 saat önce"
          description="Randevu hatırlatması"
          value={preferences.classReminderThreeHours}
          onValueChange={(value) => void updatePreference("classReminderThreeHours", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-class-one-hour"
          label="1 saat önce"
          description="Yaklaşan ders uyarısı"
          value={preferences.classReminderOneHour}
          onValueChange={(value) => void updatePreference("classReminderOneHour", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-trial-forty-eight-hours"
          label="48 saat kala"
          description="Deneme veya abonelik bitiş uyarısı"
          value={preferences.subscriptionTrialFortyEightHours}
          onValueChange={(value) => void updatePreference("subscriptionTrialFortyEightHours", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-trial-twenty-four-hours"
          label="24 saat kala"
          description="Deneme veya abonelik bitiş uyarısı"
          value={preferences.subscriptionTrialTwentyFourHours}
          onValueChange={(value) => void updatePreference("subscriptionTrialTwentyFourHours", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-trial-twelve-hours"
          label="12 saat kala"
          description="Deneme veya abonelik bitiş uyarısı"
          value={preferences.subscriptionTrialTwelveHours}
          onValueChange={(value) => void updatePreference("subscriptionTrialTwelveHours", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-trial-four-hours"
          label="4 saat kala"
          description="Deneme veya abonelik bitiş uyarısı"
          value={preferences.subscriptionTrialFourHours}
          onValueChange={(value) => void updatePreference("subscriptionTrialFourHours", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-campaign-alerts"
          label="Kampanya"
          description="Referans ve indirim sinyalleri"
          value={preferences.campaignAlerts}
          onValueChange={(value) => void updatePreference("campaignAlerts", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-weekly-summary"
          label="Haftalık özet"
          description="Ders ve süreklilik özeti"
          value={preferences.weeklySummary}
          onValueChange={(value) => void updatePreference("weeklySummary", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-package-expiry"
          label="Paket bitiyor"
          description="Yenileme uyarıları"
          value={preferences.packageEndingAlerts}
          onValueChange={(value) => void updatePreference("packageEndingAlerts", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-measurement-reminders"
          label="Ölçüm hatırlatması"
          description="Ölçüm girme ve güncelleme sinyalleri"
          value={preferences.measurementReminders}
          onValueChange={(value) => void updatePreference("measurementReminders", value)}
          disabled={!canEditPreferences}
        />
        <ToggleRow
          testID="notification-pref-quiet-hours"
          label="Sessiz saatler"
          description={`${preferences.quietHoursStart} - ${preferences.quietHoursEnd} arasında bildirimleri sınırlamak için`}
          value={preferences.quietHoursEnabled}
          onValueChange={(value) => void updatePreference("quietHoursEnabled", value)}
          disabled={!canEditPreferences}
        />
        {preferences.quietHoursEnabled ? (
          <View style={styles.quietHoursFields}>
            <FormField
              label="Sessiz saat başlangıcı"
              value={preferences.quietHoursStart}
              placeholder="22:00"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
              helper="24 saat formatında gir. Örnek: 22:00"
              onChangeText={(value) => setPreferences((current) => ({ ...current, quietHoursStart: value }))}
              onEndEditing={() => commitQuietHour("quietHoursStart", preferences.quietHoursStart)}
            />
            <FormField
              label="Sessiz saat bitişi"
              value={preferences.quietHoursEnd}
              placeholder="08:00"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
              helper="Gece yarısını aşan aralıklar desteklenir."
              onChangeText={(value) => setPreferences((current) => ({ ...current, quietHoursEnd: value }))}
              onEndEditing={() => commitQuietHour("quietHoursEnd", preferences.quietHoursEnd)}
            />
          </View>
        ) : null}
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
  quietHoursFields: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
