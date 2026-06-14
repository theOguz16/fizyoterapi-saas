import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

const STEPS = [
  "Salon yöneticin eğitmen davetini oluşturur.",
  "Sana iletilen kodu veya bağlantıyı bu uygulamada açarsın.",
  "Hesabın salona bağlanınca takvim ve danışan ekranların açılır.",
];

export default function TrainerInviteGuideScreen() {
  const router = useRouter();

  return (
    <MarketingShell
      title="Eğitmen hesabını salon davetiyle bağla"
      subtitle="Eğitmen profilleri bir salon yöneticisinin davetiyle etkinleşir. Böylece takvim ve danışan erişimi doğru salona güvenli şekilde bağlanır."
      icon="trainer"
      footer={<ActionButton testID="trainer-invite-guide-continue" label="Davet kodum var" icon="trainer" onPress={() => router.push("/(auth)/invite-accept" as never)} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Gerekli bilgi" value="Davet kodu" hint="Salon yöneticinden" icon="scan" />
        <MetricCard label="Sonuç" value="Aktif eğitmen" hint="Salon bağlantısı" icon="calendar" />
      </View>

      <SurfaceCard tone="primary">
        <Text style={styles.title}>Henüz davet kodun yoksa</Text>
        <Text style={styles.copy}>Çalışacağın salonun yöneticisinden FizyoFlow eğitmen daveti oluşturmasını iste. Kişisel bir üyelik kodu veya App Store ödeme işlemi bu adımın yerine geçmez.</Text>
      </SurfaceCard>

      <SurfaceCard>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <AppIcon name={index === 2 ? "spark" : "arrow-right"} size="sm" tone="primary" />
            <Text style={styles.copy}>{step}</Text>
          </View>
        ))}
      </SurfaceCard>

      <ActionButton label="Giriş ekranına dön" icon="arrow-left" variant="ghost" onPress={() => router.replace("/(auth)/login" as never)} />
    </MarketingShell>
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
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
});
