// Bu sayfa mobil uygulamada admin akisindaki notifications ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminNotificationLogsApi, getAdminSettingsApi, triggerAdminNotificationTemplate } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SectionTitle } from "@/theme/components/section-title";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [audience, setAudience] = useState("ALL_MEMBERS");
  const [message, setMessage] = useState("");

  const settingsQuery = useQuery({ queryKey: ["admin-settings"], queryFn: getAdminSettingsApi });
  const logsQuery = useQuery({ queryKey: ["admin-notification-logs"], queryFn: () => getAdminNotificationLogsApi(20) });
  const templates = useMemo(() => {
    const rows = Array.isArray(settingsQuery.data?.notification_templates) ? settingsQuery.data.notification_templates : [];
    return rows.filter((row: any) => row.is_active !== false);
  }, [settingsQuery.data]);
  const selectedTemplate = templates.find((template: any) => template.id === selectedTemplateId) || null;
 const triggerMutation = useMutation({
  mutationFn: () =>
    triggerAdminNotificationTemplate({
      type: String(selectedTemplate?.type || ""),
      send_now: true,
      audience,
    }),

  meta: {
    invalidates: [["admin-notification-logs"]],
  },

  onSuccess: () => {
    setMessage("Bildirim tetiklendi.");
  },

  onError: (e) => {
    setMessage(e instanceof Error ? e.message : "Bildirim gönderilemedi.");
  },
});
  const logs = Array.isArray(logsQuery.data) ? logsQuery.data : [];
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  return (
    <AppShell
      title="Bildirim merkezi"
      subtitle="Hazır bildirim şablonlarını seç, hedef kitleyi belirle ve anlık gönderim başlat."
      icon="notifications"
      refreshing={settingsQuery.isRefetching || logsQuery.isRefetching}
      onRefresh={() => {
        void settingsQuery.refetch();
        void logsQuery.refetch();
      }}
      onBack={() => router.replace((backTo || "/(admin)/dashboard") as never)}
    >
      <SurfaceCard tone="primary">
        <SectionTitle title="Gönderim özeti" subtitle="Bu ekran hızlı bildirim göndermek için kullanılır." />
        <View style={styles.metricGrid}>
          <MetricCard label="Aktif şablon" value={templates.length} hint="Gönderime açık" icon="notifications" />
          <MetricCard label="Hedef" value={audienceLabel(audience)} hint="Seçili kitle" icon="members" />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Hedef kitle" subtitle="Bildirim bu seçime göre ilgili kullanıcı grubuna gönderilir." />
        <SegmentedSwitch
          value={audience}
          onChange={setAudience}
          options={[
            { label: "Üyeler", value: "ALL_MEMBERS" },
            { label: "Riskliler", value: "AT_RISK" },
            { label: "Eğitmenler", value: "TRAINERS" },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Şablon seç" subtitle="Aktif bildirim şablonlarından birini seçerek hızlı gönderim yapabilirsin." />
        <ScrollPanel maxHeight={360} contentContainerStyle={styles.templateList}>
          {templates.map((template: any) => {
            const selected = selectedTemplateId === template.id;
            return (
              <Pressable key={template.id} onPress={() => setSelectedTemplateId(template.id)} style={[styles.templateCard, selected ? styles.templateCardActive : null]}>
                <View style={styles.templateHeader}>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                  <StatusBadge label={template.type || "TEMPLATE"} tone="info" />
                </View>
                <Text style={styles.templateItem}>Şablon türü: {template.type}</Text>
                <Text style={styles.templateId}>Kimlik: {template.id}</Text>
                <Text style={styles.templateItem}>Seçilen kullanıcı grubuna anlık bildirim ve hatırlatma akışında kullanılır.</Text>
              </Pressable>
            );
          })}
        </ScrollPanel>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <ActionButton
          label="Hemen gönder"
          icon="notifications"
          onPress={() => triggerMutation.mutate()}
          loading={triggerMutation.isPending}
          disabled={!selectedTemplate?.type}
        />
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Son gönderimler" subtitle="Gönderim kayıtlarında üye adı ve bildirim içeriği görünür." />
        {logs.length === 0 ? (
          <Text style={styles.message}>Henüz bildirim kaydı yok.</Text>
        ) : (
          <ScrollPanel maxHeight={360} contentContainerStyle={styles.templateList}>
            {logs.map((log: any) => (
              <View key={String(log.id)} style={styles.templateCard}>
                <View style={styles.templateHeader}>
                  <Text style={styles.templateTitle}>{log.member_full_name || log.member_email || "İsimsiz üye"}</Text>
                  <StatusBadge label={String(log.status || "PENDING")} tone={log.error_message ? "danger" : "success"} />
                </View>
                <Text style={styles.templateItem}>{log.title || "Bildirim"}</Text>
                {log.body ? <Text style={styles.templateItem}>{log.body}</Text> : null}
                <Text style={styles.templateId}>{formatLogDate(log.created_at)}</Text>
              </View>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>
    </AppShell>
  );
}

function audienceLabel(audience: string) {
  switch (audience) {
    case "AT_RISK":
      return "Riskli Üyeler";
    case "TRAINERS":
      return "Eğitmenler";
    default:
      return "Tüm Üyeler";
  }
}

function formatLogDate(value?: string | null) {
  if (!value) return "Tarih bilinmiyor";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tarih bilinmiyor" : date.toLocaleString("tr-TR");
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  templateList: { gap: tokens.spacing.sm },
  templateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  templateCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceSoft,
    ...tokens.shadow.soft,
  },
  templateCardActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}18`,
    ...tokens.shadow.focus,
  },
  templateTitle: { color: tokens.colors.text, fontSize: tokens.font.sm, fontWeight: "800", flex: 1, lineHeight: 20 },
  templateItem: { color: tokens.colors.text, fontSize: tokens.font.xs, lineHeight: 18 },
  templateId: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  message: { color: tokens.colors.textMuted, fontSize: tokens.font.sm },
});
