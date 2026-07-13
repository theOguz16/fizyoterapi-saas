import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { createClinıcRequestApi } from "@/lib/mobile-api";
import { useSession } from "@/providers/auth-session";
import { TURKEY_CITIES, TURKEY_DISTRICTS_BY_CITY } from "@/lib/turkey-locations";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { FormField } from "@/theme/components/form-field";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ToggleRow } from "@/theme/components/toggle-row";
import { tokens } from "@/theme/tokens";

type PickerMode = "city" | "district" | null;

export default function AdminSalonSetupScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    clinic_name: "",
    city: "",
    district: "",
    phone: "",
    about_text: "",
    owner_is_practitioner: true,
  });

  const cityKey = form.city ? form.city.toLocaleUpperCase("tr-TR") : "";
  const districtOptions = useMemo(() => (cityKey ? [...(TURKEY_DISTRICTS_BY_CITY[cityKey] || [])] : []), [cityKey]);
  const visibleOptions = useMemo(() => {
    const source = pickerMode === "city" ? [...TURKEY_CITIES] : districtOptions;
    const normalizedQuery = query.trim().toLocaleUpperCase("tr-TR");
    if (!normalizedQuery) return source;
    return source.filter((item) => item.includes(normalizedQuery));
  }, [districtOptions, pickerMode, query]);

  const mutation = useMutation({
  mutationFn: () =>
    createClinıcRequestApi({
      ...form,
      city: form.city.trim(),
      district: form.district.trim(),
      phone: form.phone.trim(),
      clinic_name: form.clinic_name.trim(),
      about_text: form.about_text.trim(),
    }),

  meta: {
    invalidates: [
      ["me"],
      ["session"],
      ["my-clinic-request"],
      ["admin-clinic-subscription"],
      ["admin-settings"],
    ],
  },

  onSuccess: async () => {
    await refreshMe();
    router.replace("/(admin)/dashboard" as never);
  },
});

  function openPicker(mode: Exclude<PickerMode, null>) {
    setPickerMode(mode);
    setQuery("");
  }

  function closePicker() {
    setPickerMode(null);
    setQuery("");
  }

  function handleSelect(value: string) {
    if (pickerMode === "city") {
      setForm((prev) => ({
        ...prev,
        city: toDisplayLabel(value),
        district: "",
      }));
    }
    if (pickerMode === "district") {
      setForm((prev) => ({
        ...prev,
        district: toDisplayLabel(value),
      }));
    }
    closePicker();
  }

  function handleSubmit() {
    if (!form.clinic_name.trim() || !form.city.trim() || !form.district.trim() || !form.phone.trim()) {
      setError("Salon adı, şehir, ilçe ve telefon alanlarını doldurman gerekiyor.");
      return;
    }
    setError("");
    mutation.mutate();
  }

  return (
    <>
      <AppShell title="Salon kurulumunu tamamla" subtitle="Salon kartında görünecek temel bilgileri ekle. Kurulum tamamlandığında salon ayarları ve çalışma saatleri ekranı açılır." icon="clinic" showBackButton={false}>
        <View style={styles.metricsRow}>
          <MetricCard label="Kurulum" value="1. adım" hint="Temel bilgiler" icon="clinic" />
          <MetricCard label="Süre" value="2 dk" hint="Hızlı tamamlanır" icon="clock" />
        </View>

        <SurfaceCard tone="primary">
          <Text style={styles.leadTitle}>Salonunu doğru bilgilerle yayına hazırla</Text>
          <Text style={styles.copy}>
            Salon adı, konum, iletişim ve kısa açıklama bilgileri; ekip ve üyelerin gördüğü temel salon profilini oluşturur.
          </Text>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Çalışma rolün</Text>
          <ToggleRow
            label="Ben de bu klinikte hizmet veriyorum"
            description="Aynı hesapla hem klinik yönetimine hem fizyoterapist/eğitmen çalışma alanına erişirsin."
            value={form.owner_is_practitioner}
            onValueChange={(value) => setForm((prev) => ({ ...prev, owner_is_practitioner: value }))}
          />
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Salon bilgileri</Text>
          <FormField
            label="Salon / klinik adı"
            value={form.clinic_name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, clinic_name: value }))}
            placeholder="Salon veya klinik adını gir"
          />
          <PickerField label="Şehir" value={form.city} placeholder="Şehir seç" onPress={() => openPicker("city")} />
          <PickerField
            label="İlçe"
            value={form.district}
            placeholder={form.city ? "İlçe seç" : "Önce şehir seç"}
            onPress={() => openPicker("district")}
            disabled={!form.city}
          />
          <FormField
            label="Telefon"
            value={form.phone}
            onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            placeholder="05xx xxx xx xx"
            keyboardType="phone-pad"
          />
          <FormField
            label="Kısa açıklama"
            value={form.about_text}
            onChangeText={(value) => setForm((prev) => ({ ...prev, about_text: value }))}
            placeholder="Salonun uzmanlık alanını ve öne çıkan yaklaşımını kısa bir cümleyle anlat."
            multiline
            numberOfLines={4}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Kurulumdan sonra açılacak alanlar</Text>
          <View style={styles.bulletList}>
            <Bullet text="Çalışma saatleri ve slot süresi ayarları" />
            <Bullet text="Salon profili ve iletişim bilgileri" />
            <Bullet text="Eğitmen davetleri ve üye operasyonu" />
          </View>
        </SurfaceCard>

        <ActionButton label="Salon kurulumunu tamamla" icon="clinic" onPress={handleSubmit} loading={mutation.isPending} />
      </AppShell>

      <Modal visible={pickerMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePicker}>
        <View style={styles.sheetSafe}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={closePicker} style={styles.sheetClose}>
              <AppIcon name="arrow-left" size="sm" tone="neutral" variant="plain" />
            </Pressable>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>{pickerMode === "city" ? "Şehir seç" : "İlçe seç"}</Text>
              <Text style={styles.sheetSubtitle}>{pickerMode === "city" ? "Türkiye'deki tüm iller listelenir." : `${form.city} için uygun ilçeler listelenir.`}</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={pickerMode === "city" ? "Şehir ara" : "İlçe ara"}
              placeholderTextColor={tokens.colors.textMuted}
              style={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.optionList} keyboardShouldPersistTaps="handled">
            {visibleOptions.map((item) => (
              <Pressable key={item} onPress={() => handleSelect(item)} style={({ pressed }) => [styles.optionRow, pressed ? styles.optionRowPressed : null]}>
                <Text style={styles.optionLabel}>{toDisplayLabel(item)}</Text>
                <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
              </Pressable>
            ))}
            {visibleOptions.length === 0 ? <Text style={styles.emptyText}>Aramana uygun sonuç bulunamadı.</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function PickerField({
  label,
  value,
  placeholder,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.fieldButton, disabled ? styles.fieldButtonDisabled : null, pressed ? styles.fieldButtonPressed : null]}>
        <Text style={[styles.fieldValue, !value ? styles.fieldPlaceholder : null]}>{value || placeholder}</Text>
        <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
      </Pressable>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function toDisplayLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((part) => (part ? `${part[0].toLocaleUpperCase("tr-TR")}${part.slice(1)}` : part))
    .join(" ");
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  leadTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  fieldButton: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    ...tokens.shadow.soft,
  },
  fieldButtonDisabled: {
    opacity: 0.56,
  },
  fieldButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  fieldValue: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  fieldPlaceholder: {
    color: tokens.colors.textMuted,
  },
  bulletList: {
    gap: tokens.spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "center",
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: tokens.colors.primaryStrong,
  },
  bulletText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  sheetSafe: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  sheetTitleWrap: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  sheetSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  searchWrap: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  searchInput: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    color: tokens.colors.text,
    paddingHorizontal: tokens.spacing.md,
    fontFamily: tokens.fontFamily.regular,
  },
  optionList: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  optionRow: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  optionRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  optionLabel: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  emptyText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    textAlign: "center",
    fontFamily: tokens.fontFamily.regular,
    paddingVertical: tokens.spacing.lg,
  },
});
