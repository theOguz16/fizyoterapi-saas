// Bu sayfa mobil uygulamada admin akisindaki pricing ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAdminSettingsApi, updateAdminSettingsApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

export default function AdminPricingScreen() {
  const query = useQuery({ queryKey: ["admin-pricing"], queryFn: getAdminSettingsApi });
  const [price, setPrice] = useState("");
  const [ratio, setRatio] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const pricing = query.data?.pricing_rules || {};
    setPrice(String(pricing.base_price || ""));
    setRatio(String(pricing.trainer_ratio || ""));
  }, [query.data]);

  const mutation = useMutation({
  mutationFn: () =>
    updateAdminSettingsApi({
      ...(query.data || {}),
      pricing_rules: {
        base_price: price,
        trainer_ratio: ratio,
      },
    }),

  meta: {
    invalidates: [
      ["admin-settings"],
      ["admin-dashboard"],
    ],
  },
});

  return (
    <AppShell title="Fiyat ve oranlar" subtitle="Paket baz fiyatını ve eğitmen oranlarını tek panelden güncelle." icon="pricing" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.metricsRow}>
        <MetricCard label="Baz fiyat" value={price || "-"} hint="Paket tabanı" icon="pricing" />
        <MetricCard label="Eğitmen oranı" value={ratio || "-"} hint="Yüzdesel dağılım" icon="earnings" />
      </View>
      <SurfaceCard>
        <Text style={styles.section}>Fiyat ayarları</Text>
        <FormField label="Paket baz fiyatı" value={price} onChangeText={setPrice} placeholder="7500" keyboardType="numeric" />
        <FormField label="Eğitmen oranı" value={ratio} onChangeText={setRatio} placeholder="%40" />
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.section}>Operasyon notu</Text>
        <FormField label="Ders bazlı not" value={note} onChangeText={setNote} placeholder="Fiyat veya oran için operasyon notunu yazın" multiline numberOfLines={4} />
      </SurfaceCard>
      <ActionButton label="Kaydet" icon="pricing" onPress={() => mutation.mutate()} loading={mutation.isPending} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
});
