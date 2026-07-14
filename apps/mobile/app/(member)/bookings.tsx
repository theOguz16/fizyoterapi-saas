// Bu sayfa mobil uygulamada member akisindaki bookings ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getMemberBookingsApi } from "@/lib/mobile-api";
import { formatGroupClassPrice, getGroupClassDisplayName } from "@/lib/group-classes";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SectionTitle } from "@/theme/components/section-title";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { tokens } from "@/theme/tokens";
import { filterMemberBookingsBySegment, getBookingCancelState } from "@/lib/member-bookings";

export default function MemberBookingsScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState("upcoming");
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["member-bookings"],
    queryFn: getMemberBookingsApi,
  });

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filteredRows = useMemo(() => {
    return filterMemberBookingsBySegment(rows, segment as "upcoming" | "history");
  }, [rows, segment]);

  return (
    <AppShell
      testID="member-bookings-screen"
      title="Takvim"
      subtitle="Yaklaşan derslerini, geçmiş kayıtlarını ve iptal kurallarını tek akışta yönet."
      icon="calendar"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      showBackButton
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Toplam kayıt" value={rows.length} hint="Yaklaşan ve geçmiş" icon="calendar" />
        <MetricCard label="Görünüm" value={segment === "upcoming" ? "Yaklaşan" : "Geçmiş"} hint="Seçili sekme" icon="today" />
      </View>
      <SurfaceCard>
        <SectionTitle title="İptal kuralı" subtitle="İptal en az 3 saat önce yapılmalıdır, ücret iadesi yoktur." />
      </SurfaceCard>

      <SegmentedSwitch testID="member-bookings-segment" value={segment} options={[{ label: "Yaklaşan", value: "upcoming" }, { label: "Geçmiş", value: "history" }]} onChange={setSegment} />

      {filteredRows.length === 0 ? (
        <EmptyPanel title="Randevu görünmüyor" description={segment === "upcoming" ? "Yaklaşan derslerin burada listelenecek." : "Geçmiş derslerin burada listelenecek."} iconName="calendar" iconTone="warning" />
      ) : null}

      {filteredRows.length > 0 ? (
        <ScrollPanel maxHeight={480}>
          {filteredRows.map((row: any, index: number) => (
            <Pressable
              testID={`member-booking-card-${index}`}
              key={row.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(member)/booking/[id]",
                  params: { id: row.id, backTo: "/(member)/bookings" },
                } as never)
              }
            >
              <View style={styles.rowTop}>
                <Text style={styles.title}>{row.is_group_class ? getGroupClassDisplayName(row) || row.session_title || row.lesson_category_label || "Grup dersi" : row.is_duo ? "Duo ders" : row.session_title || row.lesson_category_label || "Randevu"}</Text>
                <Text style={[styles.badge, getBookingCancelState(row) === "İptal edilebilir" ? styles.badgeSuccess : styles.badgeWarning]}>{getBookingCancelState(row)}</Text>
              </View>
              <Text style={styles.item}>{new Date(row.starts_at).toLocaleString("tr-TR")}</Text>
              <Text style={styles.item}>Eğitmen: {row.trainer_full_name || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Ders tipi: {row.is_group_class ? `Grup dersi${row.lesson_name ? ` • ${row.lesson_name}` : ""}` : row.is_duo ? "İkili ders" : row.lesson_category_label || row.lesson_category || "Belirtilmedi"}</Text>
              {row.is_duo ? <Text style={styles.item}>Partner: {row.duo_partner_name || "Davet bekleniyor"} • {row.duo_status || "Partner ödemesi bekleniyor"}</Text> : null}
              <Text style={styles.item}>Paket: {row.package_name || row.package_title || "Belirtilmedi"}</Text>
              {row.is_group_class ? <Text style={styles.item}>Ücret onayı: {formatGroupClassPrice(row.price)}</Text> : null}
              {row.is_group_class ? <Text style={styles.item}>Katılım: {row.status === "PENDING" ? "Admin onayı bekliyor" : "Onaylandı"}</Text> : null}
              <Text style={styles.hint}>Kartı açarak check-in ve iptal detayını görebilirsin.</Text>
            </Pressable>
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
  card: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: 6,
    backgroundColor: tokens.colors.surface,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontWeight: "800",
    flex: 1,
    fontFamily: tokens.fontFamily.bold,
  },
  item: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.regular,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  badge: {
    fontSize: tokens.font.xs,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontFamily: tokens.fontFamily.bold,
  },
  badgeSuccess: {
    color: "#ECFDF5",
    backgroundColor: tokens.colors.success,
  },
  badgeWarning: {
    color: "#FFF7ED",
    backgroundColor: tokens.colors.warning,
  },
});
