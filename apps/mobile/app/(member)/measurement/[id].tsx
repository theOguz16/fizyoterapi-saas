// Bu sayfa mobil uygulamada member akisindaki detay ekranini temsil eder.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { createMemberMeasurementApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { FormField } from "@/theme/components/form-field";
import { SurfaceCard } from "@/theme/components/surface-card";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

export default function AddMeasurementScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    height_cm: "",
    weight_kg: "",
    fat_percent: "",
    muscle_kg: "",
    note: "",
  });

  const mutation = useMutation({
  mutationFn: () =>
    createMemberMeasurementApi({
      measured_at: form.measured_at,
      height_cm: form.height_cm,
      weight_kg: form.weight_kg,
      fat_percent: form.fat_percent,
      muscle_kg: form.muscle_kg,
      extras: form.note ? { note: form.note } : undefined,
    }),

  meta: {
    invalidates: [
      ["member-measurements"],
      ["member-home"],
      ["member-home-v2"],
      ["member-profile"],

      ["trainer-member-measurements"],
      ["trainer-member-detail"],

      ["admin-member-measurements"],
      ["admin-member-detail"],
      ["admin-risk-members"],
      ["trainer-risk"],
    ],
  },

  onSuccess: () => {
    router.replace("/(member)/measurements" as never);
  },
});
  
  return (
    <AppShell 
      title="Yeni Ölçüm Ekle" 
      subtitle="Kişisel fiziksel ölçümlerini kaydederek gelişimini takip et." 
      icon="measurements"
    >
      <SurfaceCard tone="primary">
        <View style={styles.cardHeader}>
          <AppIcon name="calendar" size="sm" tone="primary" />
          <Text style={styles.sectionTitle}>Ölçüm Zamanı</Text>
        </View>
        <FormField 
          label="Tarih" 
          inputId="measurement-date-input"
          value={form.measured_at} 
          onChangeText={(value) => setForm((prev) => ({ ...prev, measured_at: value }))} 
          placeholder="YYYY-AA-GG" 
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="measurements" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Vücut Metrikleri</Text>
        </View>
        
        {/* Yan yana iki form alanı için Row yapısı */}
        <View style={styles.formRow}>
          <View style={styles.halfWidth}>
            <FormField
              inputId="measurement-height-input"
              label="Boy"
              value={form.height_cm}
              onChangeText={(value) => setForm((prev) => ({ ...prev, height_cm: normalizeMeasurementNumber(value) }))}
              placeholder="cm"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
          <View style={styles.halfWidth}>
            <FormField
              inputId="measurement-weight-input"
              label="Kilo"
              value={form.weight_kg}
              onChangeText={(value) => setForm((prev) => ({ ...prev, weight_kg: normalizeMeasurementNumber(value) }))}
              placeholder="kg"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.halfWidth}>
            <FormField
              inputId="measurement-fat-input"
              label="Yağ Oranı"
              value={form.fat_percent}
              onChangeText={(value) => setForm((prev) => ({ ...prev, fat_percent: normalizeMeasurementNumber(value) }))}
              placeholder="%"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
          <View style={styles.halfWidth}>
            <FormField
              inputId="measurement-muscle-input"
              label="Kas Kütlesi"
              value={form.muscle_kg}
              onChangeText={(value) => setForm((prev) => ({ ...prev, muscle_kg: normalizeMeasurementNumber(value) }))}
              placeholder="kg"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="notes" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Ekstra Notlar</Text>
        </View>
        <FormField 
          label="Günlük Notu (Opsiyonel)" 
          inputId="measurement-note-input"
          value={form.note} 
          onChangeText={(value) => setForm((prev) => ({ ...prev, note: value }))} 
          placeholder="Kendin için bir not bırak... (Örn: Bu hafta diyete sadık kaldım)" 
          multiline 
          numberOfLines={3} 
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
        />
      </SurfaceCard>

      <View style={styles.infoBox}>
        <AppIcon name="risk" size="sm" tone="neutral" />
        <Text style={styles.info}>
          Buraya girdiğin veriler kişisel gelişim grafiğine işlenir ve sadece senin & eğitmeninin görebileceği şekilde güvenle saklanır.
        </Text>
      </View>

      <ActionButton 
        testID="measurement-save-button"
        label="Ölçümü Kaydet" 
        icon="measurements" 
        onPress={() => {
          Keyboard.dismiss();
          mutation.mutate();
        }} 
        loading={mutation.isPending} 
      />
    </AppShell>
  );
}

function normalizeMeasurementNumber(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [integer = "", ...decimalParts] = normalized.split(".");
  return decimalParts.length ? `${integer}.${decimalParts.join("").slice(0, 2)}` : integer;
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  formRow: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  halfWidth: {
    flex: 1,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFB",
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.sm,
  },
  info: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
