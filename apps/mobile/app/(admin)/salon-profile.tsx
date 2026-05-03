import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getAdminSettingsApi, updateAdminSettingsApi } from "@/lib/mobile-api";
import { TURKEY_CITIES, TURKEY_DISTRICTS_BY_CITY } from "@/lib/turkey-locations";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type PickerMode = "city" | "district" | null;

export default function AdminSalonProfileScreen() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["admin-salon-profile"], queryFn: getAdminSettingsApi });
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    hero_title: "",
    hero_subtitle: "",
    about_text: "",
    city: "",
    district: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    const profile = query.data?.profile || query.data || {};
    const location = profile.location || {};
    setForm({
      hero_title: String(profile.hero_title || ""),
      hero_subtitle: String(profile.hero_subtitle || ""),
      about_text: String(profile.about_text || ""),
      city: String(location.city || ""),
      district: String(location.district || ""),
      phone: String(location.phone || ""),
      address: String(location.address || ""),
    });
  }, [query.data]);

  const cityKey = form.city ? form.city.toLocaleUpperCase("tr-TR") : "";
  const districtOptions = useMemo(() => (cityKey ? [...(TURKEY_DISTRICTS_BY_CITY[cityKey] || [])] : []), [cityKey]);
  const visibleOptions = useMemo(() => {
    const source = pickerMode === "city" ? [...TURKEY_CITIES] : districtOptions;
    const normalizedSearch = search.trim().toLocaleUpperCase("tr-TR");
    if (!normalizedSearch) return source;
    return source.filter((item) => item.includes(normalizedSearch));
  }, [districtOptions, pickerMode, search]);

  const mutation = useMutation({
  mutationFn: () =>
    updateAdminSettingsApi({
      ...(query.data || {}),
      profile: {
        ...((query.data?.profile || query.data || {}) as Record<string, unknown>),
        hero_title: form.hero_title.trim(),
        hero_subtitle: form.hero_subtitle.trim(),
        about_text: form.about_text.trim(),
        location: {
          ...(((query.data?.profile || query.data || {}) as any)?.location || {}),
          city: form.city.trim(),
          district: form.district.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
      },
    }),

  meta: {
    invalidates: [
      ["admin-settings"],
      ["admin-salon-profile"],
      ["admin-settings-calendar"],
      ["intake-salons"],
      ["publıc-salon"],
      ["shared-clinics"],
    ],
  },

  onSuccess: () => {
    showInfoAlert(
      "Salon profili güncellendi",
      "Salon bilgileri kayıt edildi."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Salon profili güncellenemedi",
      error,
      "Bilgiler kaydedilemedi. Lütfen tekrar deneyin."
    );
  },
});

  function closePicker() {
    setPickerMode(null);
    setSearch("");
  }

  function handleSelect(value: string) {
    if (pickerMode === "city") {
      setForm((prev) => ({ ...prev, city: toDisplayLabel(value), district: "" }));
    } else if (pickerMode === "district") {
      setForm((prev) => ({ ...prev, district: toDisplayLabel(value) }));
    }
    closePicker();
  }

  return (
    <>
      <AppShell
        title="Salon profilini düzenle"
        subtitle="Salon kartında görünen başlık, açıklama, konum ve iletişim bilgilerini güncelle."
        icon="clinic"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onBack={() => router.replace("/(admin)/salon" as never)}
      >
        <SurfaceCard tone="primary">
          <Text style={styles.title}>Yayın görünümü</Text>
          <Text style={styles.copy}>Buradaki bilgiler salon kartında, keşif alanlarında ve ekip ekranlarında temel profil olarak kullanılır.</Text>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>Görünür içerik</Text>
          <FormField label="Başlık" value={form.hero_title} onChangeText={(value) => setForm((prev) => ({ ...prev, hero_title: value }))} placeholder="Salon vitrininizde görünecek ana başlığı girin" />
          <FormField label="Kısa alt başlık" value={form.hero_subtitle} onChangeText={(value) => setForm((prev) => ({ ...prev, hero_subtitle: value }))} placeholder="Salonunuzu kısa bir cümleyle özetleyin" />
          <FormField label="Salon açıklaması" value={form.about_text} onChangeText={(value) => setForm((prev) => ({ ...prev, about_text: value }))} placeholder="Salonun yaklaşımını ve uzmanlığını anlaşılır bir dille anlat." multiline numberOfLines={5} />
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.section}>İletişim ve konum</Text>
          <PickerField label="Şehir" value={form.city} placeholder="Şehir seç" onPress={() => setPickerMode("city")} />
          <PickerField label="İlçe" value={form.district} placeholder={form.city ? "İlçe seç" : "Önce şehir seç"} onPress={() => setPickerMode("district")} disabled={!form.city} />
          <FormField label="Telefon" value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="05xx xxx xx xx" keyboardType="phone-pad" />
          <FormField label="Adres" value={form.address} onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} placeholder="Mahalle, cadde, bina ve kat bilgisi" multiline numberOfLines={3} />
        </SurfaceCard>

        <ActionButton label="Değişiklikleri kaydet" icon="clinic" onPress={() => mutation.mutate()} loading={mutation.isPending} />
      </AppShell>

      <Modal visible={pickerMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePicker}>
        <View style={styles.sheetSafe}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={closePicker} style={styles.sheetClose}>
              <AppIcon name="arrow-left" size="sm" tone="neutral" variant="plain" />
            </Pressable>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>{pickerMode === "city" ? "Şehir seç" : "İlçe seç"}</Text>
              <Text style={styles.sheetSubtitle}>{pickerMode === "city" ? "Türkiye'deki tüm iller listelenir." : `${form.city} için ilçeler listelenir.`}</Text>
            </View>
          </View>
          <View style={styles.searchWrap}>
            <TextInput value={search} onChangeText={setSearch} placeholder={pickerMode === "city" ? "Şehir ara" : "İlçe ara"} placeholderTextColor={tokens.colors.textMuted} style={styles.searchInput} />
          </View>
          <ScrollView contentContainerStyle={styles.optionList}>
            {visibleOptions.map((item) => (
              <Pressable key={item} onPress={() => handleSelect(item)} style={({ pressed }) => [styles.optionRow, pressed ? styles.optionRowPressed : null]}>
                <Text style={styles.optionLabel}>{toDisplayLabel(item)}</Text>
                <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function PickerField({ label, value, placeholder, onPress, disabled = false }: { label: string; value: string; placeholder: string; onPress: () => void; disabled?: boolean }) {
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

function toDisplayLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((part) => (part ? `${part[0].toLocaleUpperCase("tr-TR")}${part.slice(1)}` : part))
    .join(" ");
}

const styles = StyleSheet.create({
  title: {
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
});
