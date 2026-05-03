// Bu sayfa mobil uygulamada member akisindaki attendance ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { MetricCard } from "@/theme/components/metric-card";
import { AppShell } from "@/theme/components/app-shell";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { getMemberAttendanceApi } from "@/lib/mobile-api";
import { tokens } from "@/theme/tokens";

export default function MemberAttendanceScreen() {
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["member-attendance"],
    queryFn: getMemberAttendanceApi,
  });

  const packageBalances = Array.isArray(data?.package_balances) ? data.package_balances : [];
  const history = Array.isArray(data?.data) ? data.data : [];

  return (
    <AppShell
      title="Katılım geçmişi"
      subtitle="Kalan haklar ve ders katılım detayları"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      showBackButton
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Toplam katılım" value={data?.summary?.total_attendance_count ?? 0} hint="Tamamlanan ders" icon="calendar" />
        <MetricCard label="Kalan hak" value={data?.summary?.remaining_total_credits ?? 0} hint="Tüm paketlerden" icon="ticket" />
      </View>

      <SurfaceCard>
        <Text style={styles.title}>Toplam özet</Text>
        <Text style={styles.item}>Toplam katılım: {data?.summary?.total_attendance_count ?? 0}</Text>
        <Text style={styles.item}>Grup katılım: {data?.summary?.group_attendance_count ?? 0}</Text>
        <Text style={styles.item}>Toplam kalan hak: {data?.summary?.remaining_total_credits ?? 0}</Text>
      </SurfaceCard>

      {packageBalances.length > 0 ? (
        <ScrollPanel maxHeight={240}>
          {packageBalances.map((row: any) => (
            <SurfaceCard key={row.user_package_id || row.package_id}>
              <Text style={styles.title}>{row.package_name || row.package_title || "Paket"}</Text>
              <Text style={styles.item}>Toplam hak: {row.total_credits ?? "-"}</Text>
              <Text style={styles.item}>Kullanılan hak: {row.used_credits ?? "-"}</Text>
              <Text style={styles.item}>Kalan hak: {row.remaining_credits ?? "-"}</Text>
              <Text style={styles.hint}>Paket bazinda devam ve yenileme sinyali burada izlenir.</Text>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      ) : null}

      {history.length > 0 ? (
        <ScrollPanel maxHeight={420}>
          {history.map((row: any) => (
            <SurfaceCard key={row.id}>
              <Text style={styles.item}>{new Date(row.created_at).toLocaleString("tr-TR")}</Text>
              <Text style={styles.item}>Sonuç: {row.result === "CREDIT_DEDUCTED" ? "Derse katıldı (1 hak düştü)" : row.result}</Text>
              <Text style={styles.item}>Eğitmen: {row.trainer_full_name || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Ders: {row.session_title || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Kategori: {row.lesson_category_label || row.lesson_category || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Paket: {row.package_name || row.package_title || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Kalan hak: {row.remaining_credits ?? "-"}</Text>
              <Text style={styles.hint}>Bu kayit sadakat, risk ve olcum takibiyle birlikte yorumlanir.</Text>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      ) : null}
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
    fontWeight: "800",
    fontSize: tokens.font.md,
  },
  item: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
  },
});
