// Bu sayfa mobil uygulamada member akisindaki detay ekranini temsil eder.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Keyboard, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { createMemberMeasurementApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { FormField } from "@/theme/components/form-field";
import { SurfaceCard } from "@/theme/components/surface-card";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";
import { getApiFieldErrors, validatePositiveNumber, type FieldErrors } from "@/lib/form-validation";
import { showErrorAlert } from "@/lib/user-feedback";
import { resolveResponsiveLayout } from "@/lib/accessibility";

type MeasurementField = "measured_at" | "height_cm" | "weight_kg" | "fat_percent" | "muscle_kg";

export default function AddMeasurementScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const responsive = resolveResponsiveLayout(width, fontScale);
  const [form, setForm] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    height_cm: "",
    weight_kg: "",
    fat_percent: "",
    muscle_kg: "",
    note: "",
  });
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<MeasurementField>>({});
  const [formError, setFormError] = useState("");

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
  onError: (error) => {
    setFieldErrors(getApiFieldErrors<MeasurementField>(error));
    setFormError("Ölçüm kaydedilemedi. İşaretli alanları kontrol et.");
    showErrorAlert("Ölçüm kaydedilemedi", error, "Ölçüm bilgilerini kontrol edip tekrar dene.");
  },
});

  function updateMetric(field: MeasurementField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError("");
  }

  function submitMeasurement() {
    if (mutation.isPending) return;
    Keyboard.dismiss();
    const errors: FieldErrors<MeasurementField> = {};
    const metrics = ["height_cm", "weight_kg", "fat_percent", "muscle_kg"] as const;
    if (!metrics.some((field) => Number(form[field]) > 0)) {
      errors.weight_kg = "En az bir ölçüm değeri girmelisin.";
    }
    for (const field of metrics) {
      if (!form[field]) continue;
      const label = field === "height_cm" ? "Boy" : field === "weight_kg" ? "Kilo" : field === "fat_percent" ? "Yağ oranı" : "Kas kütlesi";
      const message = validatePositiveNumber(form[field], label, field === "fat_percent" ? { max: 100 } : undefined);
      if (message) errors[field] = message;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("İşaretli alanları kontrol et.");
      return;
    }
    setFieldErrors({});
    setFormError("");
    mutation.mutate();
  }
  
  return (
    <AppShell 
      formMode
      title="Yeni Ölçüm Ekle" 
      subtitle="Kişisel fiziksel ölçümlerini kaydederek gelişimini takip et." 
      icon="measurements"
    >
      <SurfaceCard tone="primary">
        <View style={styles.cardHeader}>
          <AppIcon name="calendar" size="sm" tone="primary" />
          <Text style={styles.sectionTitle}>Ölçüm Zamanı</Text>
        </View>
        <Text style={styles.fieldLabel}>Tarih *</Text>
        <Pressable
          testID="measurement-date-picker"
          accessibilityRole="button"
          accessibilityLabel={`Ölçüm tarihi, ${formatMeasurementDate(form.measured_at)}`}
          accessibilityHint="Ölçüm tarihini değiştirmek için dokun"
          accessibilityState={{ expanded: datePickerVisible }}
          onPress={() => { Keyboard.dismiss(); setDatePickerVisible(true); }}
          style={({ pressed }) => [styles.datePickerButton, pressed ? styles.datePickerPressed : null]}
        >
          <Text style={styles.datePickerValue}>{formatMeasurementDate(form.measured_at)}</Text>
          <Text style={styles.datePickerHint}>Değiştir</Text>
        </Pressable>
        {datePickerVisible ? (
          <View testID="measurement-date-picker-panel" style={styles.datePickerPanel}>
            <DateTimePicker
              value={new Date(`${form.measured_at}T12:00:00`)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={new Date()}
              onChange={(_event, value) => {
                if (value) updateMetric("measured_at", toLocalDateKey(value));
                if (Platform.OS !== "ios") setDatePickerVisible(false);
              }}
            />
            {Platform.OS === "ios" ? <ActionButton testID="measurement-date-picker-confirm" label="Tarihi kullan" variant="ghost" onPress={() => setDatePickerVisible(false)} /> : null}
          </View>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <AppIcon name="measurements" size="sm" tone="neutral" />
          <Text style={styles.sectionTitle}>Vücut Metrikleri</Text>
        </View>
        
        {/* Yan yana iki form alanı için Row yapısı */}
        <View style={[styles.formRow, responsive.stackColumns ? styles.formRowStacked : null]}>
          <View style={[styles.halfWidth, responsive.stackColumns ? styles.fullWidth : null]}>
            <FormField
              inputId="measurement-height-input"
              label="Boy"
              value={form.height_cm}
              onChangeText={(value) => updateMetric("height_cm", normalizeMeasurementNumber(value))}
              placeholder="cm"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              error={fieldErrors.height_cm}
              errorTestID="measurement-height-error"
            />
          </View>
          <View style={[styles.halfWidth, responsive.stackColumns ? styles.fullWidth : null]}>
            <FormField
              inputId="measurement-weight-input"
              label="Kilo"
              value={form.weight_kg}
              onChangeText={(value) => updateMetric("weight_kg", normalizeMeasurementNumber(value))}
              placeholder="kg"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              error={fieldErrors.weight_kg}
              errorTestID="measurement-weight-error"
            />
          </View>
        </View>

        <View style={[styles.formRow, responsive.stackColumns ? styles.formRowStacked : null]}>
          <View style={[styles.halfWidth, responsive.stackColumns ? styles.fullWidth : null]}>
            <FormField
              inputId="measurement-fat-input"
              label="Yağ Oranı"
              value={form.fat_percent}
              onChangeText={(value) => updateMetric("fat_percent", normalizeMeasurementNumber(value))}
              placeholder="%"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              error={fieldErrors.fat_percent}
              errorTestID="measurement-fat-error"
            />
          </View>
          <View style={[styles.halfWidth, responsive.stackColumns ? styles.fullWidth : null]}>
            <FormField
              inputId="measurement-muscle-input"
              label="Kas Kütlesi"
              value={form.muscle_kg}
              onChangeText={(value) => updateMetric("muscle_kg", normalizeMeasurementNumber(value))}
              placeholder="kg"
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              error={fieldErrors.muscle_kg}
              errorTestID="measurement-muscle-error"
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

      {formError ? <Text testID="measurement-form-error" accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <ActionButton 
        testID="measurement-save-button"
        label="Ölçümü Kaydet" 
        icon="measurements" 
        onPress={submitMeasurement}
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

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMeasurementDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Tarih seç" : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

const styles = StyleSheet.create({
  fieldLabel: { color: tokens.colors.text, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.semibold },
  datePickerButton: { minHeight: 52, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceRaised, paddingHorizontal: tokens.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  datePickerPressed: { opacity: 0.75 },
  datePickerValue: { color: tokens.colors.text, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.medium },
  datePickerHint: { color: tokens.colors.primaryStrong, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.semibold },
  datePickerPanel: { gap: tokens.spacing.sm, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surfaceRaised, padding: tokens.spacing.sm },
  error: { color: tokens.colors.danger, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.medium },
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
  formRowStacked: { flexDirection: "column" },
  fullWidth: { width: "100%", flex: 0 },
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
