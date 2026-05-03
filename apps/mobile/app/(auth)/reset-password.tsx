// Bu sayfa mobil uygulamada auth akisindaki reset password ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";

export default function ResetPasswordScreen() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <MarketingShell
      title="Şifreni sifırla"
      subtitle="E-posta veya telefonunu gir. Reset akışını bu hesap üzerinden başlatacağız."
      icon="settings"
      footer={<ActionButton label={sent ? "Kod Gönderildi" : "Kod Gönder"} icon="notifications" onPress={() => setSent(true)} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Girdi" value="E-posta / telefon" hint="Tek alan" icon="member" />
        <MetricCard label="Çıktı" value="Kod / link" hint="Servis bağlanacak" icon="notifications" />
      </View>
      <SurfaceCard>
        <FormField label="E-posta veya telefon" value={value} onChangeText={setValue} placeholder="örnek@mail.com" />
        <Text style={styles.helper}>
          {sent
            ? "Reset bağlantısı veya doğrulama kodu gönderildi varsayıldı. Backend reset endpoint'i hazır olduğunda burası doğrudan bağlanacak."
            : "Bu ekran v1'de bilgi toplar; reset servisi bağlandığinda aynı akıştan devam eder."}
        </Text>
      </SurfaceCard>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
