// Bu sayfa mobil uygulamada shared akisindaki leave salon ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { leaveSalonMembershipApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";
import { refreshSessionAfterCommittedAction } from "@/lib/user-feedback";

export default function LeaveSalonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[]; profileBackTo?: string | string[] }>();
  const { refreshMe } = useSession();
  const backTo = (Array.isArray(params.backTo) ? params.backTo[0] : params.backTo) || "/(member)/profile";
  const profileBackTo = Array.isArray(params.profileBackTo) ? params.profileBackTo[0] : params.profileBackTo;

  function cancel() {
    if (backTo === "/(shared)/account-actions") {
      router.replace({
        pathname: backTo,
        params: {
          backTo: "/(shared)/account-settings",
          profileBackTo: profileBackTo || "/(member)/profile",
        },
      } as never);
      return;
    }
    router.replace(backTo as never);
  }
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
    await refreshSessionAfterCommittedAction(refreshMe, "Salondan ayrılma");
    router.replace("/(intake-member)/salons" as never);
  },
});

  return (
    <AppShell testID="member-leave-salon-screen" title="Salondan ayrıl" subtitle="Aktif paketlerin etkilenebilir ve planlanmış derslerin iptal olabilir." icon="risk" onBack={cancel}>
      <View style={styles.metricsRow}>
        <MetricCard label="Sonuç" value="Üyelik kapanır" hint="Salon bağlantısı biter" icon="risk" />
        <MetricCard label="Sonraki adım" value="Yeni öneriler" hint="Tekrar seçim akışı" icon="salon" />
      </View>
      <SurfaceCard tone="warning">
        <Text style={styles.copy}>Bu işlem sonrası başka salon önerileri tekrar açılacak. Mevcut haklar ve onaylı dersler salon kurallarına göre güncellenebilir.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.copy}>Eğer aktif paketin veya planlanmış derslerin varsa, bunlar salon kurallarına göre iptal, iade veya yeniden planlama sürecine girebilir.</Text>
      </SurfaceCard>
      <ActionButton testID="member-leave-salon-confirm" label="Salondan Ayrıl" icon="risk" variant="danger" onPress={() => mutation.mutate()} loading={mutation.isPending} />
      <ActionButton testID="member-leave-salon-cancel" label="Vazgeç" icon="spark" variant="ghost" onPress={cancel} />
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
