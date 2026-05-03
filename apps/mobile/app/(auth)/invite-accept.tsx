// Bu sayfa mobil uygulamada auth akisindaki invite accept ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";

export default function InviteAcceptScreen() {
  const router = useRouter();
  const { resetSignupFlow } = useAppFlow();
  const { acceptInvite } = useSession();
  const [form, setForm] = useState({
    token: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    try {
      setLoading(true);
      setError("");
      await acceptInvite(form);
      resetSignupFlow();
      router.replace("/(auth)/login" as never);
    } catch (err) {
      setError(getUserFacingMessage(err, "Davet tamamlanamadı. Kodunu kontrol edip tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingShell
      title="Salon davetini tamamla"
      subtitle="Eğitmen hesabını aktif etmek için sana iletilen davet kodunu gir ve kişisel bilgilerini tamamla."
      icon="trainer"
      footer={<ActionButton label="Daveti tamamla" icon="trainer" onPress={handleAccept} loading={loading} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Bağlantı" value="Salon daveti" hint="Kod veya QR" icon="trainer" />
        <MetricCard label="Sonuç" value="Eğitmen hesabı" hint="Davet zorunlu" icon="calendar" />
      </View>
      <SurfaceCard>
        <FormField label="Davet kodu" value={form.token} onChangeText={(value) => setForm((prev) => ({ ...prev, token: value }))} placeholder="Davet kodunu gir" autoCapitalize="none" />
        <FormField label="Ad" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))} placeholder="Ad" />
        <FormField label="Soyad" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))} placeholder="Soyad" />
        <FormField label="Telefon" value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="05xx xxx xx xx" />
        <FormField label="Şifre" value={form.password} onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} placeholder="Şifre oluştur" secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.helper}>Davet tamamlandıktan sonra giriş yapabilir, bağlı olduğun salonun takvimine ve danışan akışına erişebilirsin.</Text>
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
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
