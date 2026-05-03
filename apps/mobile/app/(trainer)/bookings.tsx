// Bu sayfa mobil uygulamada trainer akisindaki bookings ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SelectionChip } from "@/theme/components/selection-chip";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SectionTitle } from "@/theme/components/section-title";
import { getTrainerAvailabilitiesApi, getTrainerBookingFormOptionsApi, getTrainerBookingsApi } from "@/lib/mobile-api";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { tokens } from "@/theme/tokens";
import { useMemo, useState } from "react";
import { bookingStatusLabel } from "@/lib/labels";

const reasonCodeLabel: Record<string, string> = {
  NO_MEMBER_ACTIVE_PACKAGE: "Danışanın aktif paketi yok",
  NO_TRAINER_ASSIGNMENT: "Eğitmene atanmış uygun paket yok",
  NO_SKILL_MATCH: "Eğitmen skill eşleşmesi yok",
};

export default function TrainerBookingsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "REQUESTS" | "BOOKINGS">("ALL");
  const bookingsQuery = useQuery({
    queryKey: ["trainer-bookings"],
    queryFn: getTrainerBookingsApi,
  });

  const formOptionsQuery = useQuery({
    queryKey: ["trainer-booking-form-options"],
    queryFn: getTrainerBookingFormOptionsApi,
  });

  const availabilitiesQuery = useQuery({
    queryKey: ["trainer-availabilities"],
    queryFn: getTrainerAvailabilitiesApi,
  });

  function canOpenCheckin(row: any) {
  if (row.status && String(row.status).toUpperCase() !== "APPROVED") return false;
  if (!row.starts_at || !row.ends_at) return true;

  const now = Date.now();
  const startsAt = new Date(row.starts_at).getTime();
  const endsAt = new Date(row.ends_at).getTime();

  const opensAt = startsAt - 30 * 60 * 1000;
  const closesAt = endsAt + 30 * 60 * 1000;

  return now >= opensAt && now <= closesAt;
}

  const rows = Array.isArray(bookingsQuery.data) ? bookingsQuery.data : [];
  const availabilityRows = Array.isArray(availabilitiesQuery.data) ? availabilitiesQuery.data : [];
  const groupClassRows = useMemo(() => rows.filter((row: any) => row.is_group_class), [rows]);
  const diagnostics = formOptionsQuery.data?.member_package_diagnostics || {};
  const visibleBookings = useMemo(() => (filter === "REQUESTS" ? [] : rows), [filter, rows]);
  const visibleRequests = useMemo(() => (filter === "BOOKINGS" ? [] : availabilityRows), [filter, availabilityRows]);

  return (
    <AppShell
      title="Takvim"
      subtitle="Günlük ve haftalık ders akışını, paket teşhisleriyle birlikte izle."
      icon="calendar"
      refreshing={bookingsQuery.isRefetching || formOptionsQuery.isRefetching || availabilitiesQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
        void formOptionsQuery.refetch();
        void availabilitiesQuery.refetch();
      }}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Planlı ders" value={rows.length} hint="Takvimde görünen" icon="calendar" />
        <MetricCard label="Uygunluk talebi" value={availabilityRows.length} hint="Slot atanacak" icon="request" />
      </View>
      <SurfaceCard tone="primary">
        <SectionTitle title="Grup dersi oluştur" subtitle="Trainer mobilde tek tarihli veya tekrar eden grup dersi açabilir; salondaki üyeleri davet edip bildirim tetikler." />
        <Text style={styles.hint}>Katıl butonuna basan üyeler önce salon tarafında toplanır, ardından admin ücret ve kapasite onayına düşer.</Text>
        <View style={styles.actions}>
          <ActionButton label="Grup derslerini yönet" icon="calendar" onPress={() => router.push("/(trainer)/group-classes" as never)} />
        </View>
      </SurfaceCard>
      <View style={styles.filters}>
        <SelectionChip label="Tümü" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
        <SelectionChip label="Talepler" active={filter === "REQUESTS"} onPress={() => setFilter("REQUESTS")} />
        <SelectionChip label="Dersler" active={filter === "BOOKINGS"} onPress={() => setFilter("BOOKINGS")} />
      </View>
      <SurfaceCard>
        <SectionTitle title="Paket teşhisleri" subtitle="Seans planlanmadan önce paket ve skill uyumunu gösterir." />
        {Object.entries(diagnostics).length === 0 ? (
          <Text style={styles.empty}>Tüm danışanlar için paket uyumu mevcut.</Text>
        ) : (
          <ScrollPanel maxHeight={180}>
            {Object.entries(diagnostics).map(([memberId, value]: [string, any]) => (
              <Text key={memberId} style={styles.item}>
                {memberId.slice(0, 8)}: {(value.reason_codes || []).map((code: string) => reasonCodeLabel[code] || code).join(", ") || "Uygun"}
              </Text>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Açık grup dersleri" subtitle="Bildirim ve admin onayı gerektiren dersler burada görünür." />
        {groupClassRows.length === 0 ? (
          <Text style={styles.empty}>Henüz açılmış grup dersi görünmüyor.</Text>
        ) : (
          <ScrollPanel maxHeight={220}>
            {groupClassRows.map((row: any) => (
              <View key={row.id} style={styles.availabilityCard}>
                <Text style={styles.title}>{row.lesson_name || row.session_title || "Grup dersi"}</Text>
                <Text style={styles.item}>{new Date(row.starts_at).toLocaleString("tr-TR")}</Text>
                <Text style={styles.item}>Plan: {row.recurrence_label || "Özel tarihli seans"}</Text>
                <Text style={styles.item}>Bildirim: {getGroupClassAudienceLabel(row.notification_scope)}</Text>
                <Text style={styles.item}>Katılım: {Number(row.joined_member_count || 0)} üye • Davet: {Number(row.invited_member_count || 0)}</Text>
                <Text style={styles.item}>Ücret: {formatGroupClassPrice(row.price)}</Text>
                <Text style={styles.hint}>{row.requires_admin_approval ? "Admin ücret onayı beklenir." : "Salon onayı sonrası yayına alınır."}</Text>
              </View>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Uygunluk Talepleri" subtitle="Mobil ve webde paylaşılan üye uygunlukları burada görünür." />
        {visibleRequests.length === 0 ? (
          <Text style={styles.empty}>Henüz paylaşılmış uygunluk yok.</Text>
        ) : (
          <ScrollPanel maxHeight={280}>
            {visibleRequests.map((row: any) => (
              <View key={row.id} style={styles.availabilityCard}>
                <Text style={styles.title}>{row.member_full_name || "Danışan"}</Text>
                <Text style={styles.item}>
                  {new Date(row.starts_at).toLocaleString("tr-TR")} - {row.ends_at ? new Date(row.ends_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </Text>
                <Text style={styles.item}>Paket: {row.package_title || "Belirtilmedi"}</Text>
                {row.note ? <Text style={styles.item}>Not: {row.note}</Text> : null}
                <Text style={styles.hint}>Önce uygun slotu seç, sonra danışanı takvime yerleştir.</Text>
              </View>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>

      {visibleBookings.length === 0 ? (
        <EmptyPanel title="Takvim boş" description="Planlanan dersler oluştuğunda burada listelenir." iconName="calendar" iconTone="warning" />
      ) : (
        <ScrollPanel maxHeight={420}>
          {visibleBookings.map((row: any) => (
            <Pressable key={row.id} style={styles.rowCard} onPress={() => row.member_id ? router.push(`/(trainer)/members/${row.member_id}` as never) : null}>
              <Text style={styles.title}>{row.member_full_name || "Belirtilmedi"}</Text>
              <Text style={styles.item}>{new Date(row.starts_at).toLocaleString("tr-TR")}</Text>
              <Text style={styles.item}>Ders: {row.session_title || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Paket: {row.package_name || row.package_title || "Belirtilmedi"}</Text>
              <Text style={styles.item}>Durum: {bookingStatusLabel(row.status)}</Text>
              <Text style={styles.hint}>Kart detayına geçerek danışan profili, notlar ve check-in akışını açabilirsin.</Text>
                <View style={styles.actions}>
                {canOpenCheckin(row) ? (
                  <ActionButton
                    label="Check-in"
                    icon="scan"
                    onPress={() =>
                      router.push({
                        pathname: "/(trainer)/checkin",
                        params: row.session_id ? { sessionId: row.session_id } : {},
                      } as never)
                    }
                  />
                ) : (
                  <Text style={styles.hint}>
                    Check-in, ders başlangıcından 30 dakika önce ve ders bitişinden 30 dakika sonra açılır.
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontWeight: "800",
    fontFamily: tokens.fontFamily.bold,
  },
  item: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.regular,
  },
  empty: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.regular,
  },
  rowCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  availabilityCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  actions: {
    paddingTop: 4,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
});
