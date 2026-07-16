import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const ACTIVATION_STEPS: Array<{
  index: number;
  title: string;
  description: string;
  icon: AppIconName;
}> = [
  {
    index: 1,
    title: "Klinik bilgileri",
    description: "Klinik adını, konumunu ve iletişim bilgilerini oluştur.",
    icon: "clinic",
  },
  {
    index: 2,
    title: "İlk hizmet veya paket",
    description: "Danışanlarına sunacağın ilk gerçek hizmeti satışa hazırla.",
    icon: "package",
  },
  {
    index: 3,
    title: "Çalışma saatleri",
    description: "Takvim günlerini, saatlerini ve seans süresini belirle.",
    icon: "clock",
  },
  {
    index: 4,
    title: "QR paylaşımı",
    description: "Hazır klinik QR'ını danışanlarınla paylaş.",
    icon: "qr",
  },
];

export default function OwnerPlanScreen() {
  const router = useRouter();

  return (
    <MarketingShell
      title="Önce kliniğini çalışır hale getir"
      subtitle="Plan kararından önce dört kısa adımda ilk hizmetini ve danışan QR'ını hazırla."
      icon="clinic"
      footer={
        <ActionButton
          testID="owner-plan-start-trial"
          label="Klinik hesabını oluştur"
          icon="spark"
          onPress={() => router.replace("/(auth)/register" as never)}
        />
      }
    >
      <SurfaceCard testID="owner-plan-value-proof" tone="primary">
        <Text style={styles.eyebrow}>DÖRT ADIMDA AKTİVASYON</Text>
        <Text style={styles.sectionTitle}>İlk oturumun sonunda hazır olacaklar</Text>
        <Text style={styles.copy}>Klinik, paket, takvim ve QR adımları tamamlandıktan sonra plan ve deneme seçeneklerini değerlendirebilirsin.</Text>
      </SurfaceCard>

      <View style={styles.stepList}>
        {ACTIVATION_STEPS.map((step) => (
          <View key={step.index} style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>{step.index}</Text>
            </View>
            <AppIcon name={step.icon} size="sm" tone="primary" />
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  stepList: {
    gap: tokens.spacing.sm,
  },
  stepRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  stepIndex: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primarySoft,
  },
  stepIndexText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  stepTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  stepDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
