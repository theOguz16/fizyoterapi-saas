// Bu sayfa mobil uygulamada trainer akisindaki members ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerMembersApi, type TrainerMemberListItem } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TrainerMembersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data, isRefetching, refetch } = useQuery({ queryKey: ["trainer-members"], queryFn: getTrainerMembersApi });
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return rows;
    return rows.filter((row: TrainerMemberListItem) =>
      [row.full_name, row.email, row.phone].some((field) => String(field || "").toLocaleLowerCase("tr").includes(q))
    );
  }, [query, rows]);

  return (
    <AppShell
      title="Danışanlar"
      subtitle="Portföyündeki üyeleri ara, aç ve saha akışında hızlıca detaylarına geç."
      icon="members"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Toplam danışan" value={rows.length} hint="Kendi portföyün" icon="members" />
        <MetricCard label="Filtreli sonuç" value={filteredRows.length} hint="Arama çıktısı" icon="search" />
      </View>
      <SurfaceCard>
        <FormField label="Danışan ara" value={query} onChangeText={setQuery} placeholder="İsim, e-posta veya telefon" />
      </SurfaceCard>

      {filteredRows.length === 0 ? (
        <EmptyPanel
          title="Danışan bulunamadı"
          description="Arama kriterini değiştir veya listeyi yenileyip portföyündeki üyeleri tekrar getir."
          iconName="members"
          iconTone="primary"
        />
      ) : null}

      {filteredRows.map((row: TrainerMemberListItem) => (
        <Pressable
          key={row.id}
          style={styles.rowCard}
          onPress={() =>
            router.push({
              pathname: "/(trainer)/members/[id]",
              params: { id: row.id, backTo: "/(trainer)/members" },
            } as never)
          }
        >
          <View style={styles.rowHeader}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{row.full_name || "Danışan"}</Text>
              <Text style={styles.subtitle}>{row.phone || "Telefon yok"}</Text>
            </View>
            <View style={[styles.statusBadge, row.is_active ? styles.statusBadgeActive : styles.statusBadgePassive]}>
              <AppIcon name={row.is_active ? "approvals" : "risk"} size="sm" tone={row.is_active ? "success" : "warning"} />
              <Text style={[styles.statusText, row.is_active ? styles.statusActive : styles.statusPassive]}>{row.is_active ? "Aktif" : "Donduruldu"}</Text>
            </View>
          </View>
          <View style={styles.detailPanel}>
            <DetailRow label="E-posta" value={row.email || "E-posta yok"} />
            <DetailRow label="Telefon" value={row.phone || "Telefon yok"} />
          </View>
          <Text style={styles.hint}>Detay ekranında paket, notlar, ölçümler ve takip sinyalleri açılır.</Text>
        </Pressable>
      ))}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  rowCard: {
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, fontWeight: "800", fontFamily: tokens.fontFamily.bold },
  subtitle: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.regular },
  detailPanel: {
    gap: tokens.spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  detailLabel: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusBadgeActive: {
    backgroundColor: tokens.colors.successSoft,
  },
  statusBadgePassive: {
    backgroundColor: tokens.colors.warningSoft,
  },
  statusText: { fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.bold },
  statusActive: { color: tokens.colors.success },
  statusPassive: { color: tokens.colors.warning },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
});
