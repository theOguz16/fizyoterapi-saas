// Bu sayfa mobil uygulamada shared akisindaki leave salon ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { leaveSalonMembershipApi } from "@/lib/mobile-api";
import { safeBack } from "@/lib/navigation";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";

export default function LeaveSalonScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();
  const mutation = useMutation({
  mutationFn: leaveSalonMembershipApi,

  meta: {
    invalidates: [
      ["me"],
      ["session"],
      ["my-salon-applications"],
      ["member-home"],
      ["member-home-v2"],
      ["member-packages"],
      ["member-my-packages"],
      ["member-bookings"],
      ["member-payment-requests"],
      ["member-change-requests"],
      ["member-group-classes"],

      ["trainer-members"],
      ["trainer-bookings"],
      ["trainer-today"],

      ["admin-members"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-bookings"],
      ["admin-risk-members"],
    ],
  },

  onSuccess: async () => {
    await refreshMe();
    router.replace("/(intake-member)/salons" as never);
  },
});

  return (
    <AppShell title="Salondan ayril" subtitle="Aktif paketlerin etkilenebilir ve planlanmis derslerin iptal olabilir." icon="risk">
      <View style={styles.metricsRow}>
        <MetricCard label="Sonuc" value="Uyelik kapanir" hint="Salon bağlantısi biter" icon="risk" />
        <MetricCard label="Sonraki adim" value="Yeni oneriler" hint="Tekrar seçim akışı" icon="salon" />
      </View>
      <SurfaceCard tone="warning">
        <Text style={styles.copy}>Bu işlem sonrasi baska salon önerileri tekrar acilacak. Mevcut haklar ve onayli dersler salon kurallarına göre güncellenebilir.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.copy}>Eger aktif paketin veya planlanmış derslerin varsa, bunlar salon kurallarına göre iptal, iade veya yeniden planlama sürecine girebilir.</Text>
      </SurfaceCard>
      <ActionButton label="Salondan Ayril" icon="risk" variant="danger" onPress={() => mutation.mutate()} loading={mutation.isPending} />
      <ActionButton label="Vazgeç" icon="spark" variant="ghost" onPress={() => safeBack(router, "/(member)/profile")} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
