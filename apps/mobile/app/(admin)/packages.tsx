import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  type AdminPackage,
  type AdminPackageAssignment,
  type AdminPackageFormTemplate,
  createAdminPackageApi,
  createAdminPackageAssignmentApi,
  deleteAdminPackageApi,
  deleteAdminPackageAssignmentApi,
  getAdminPackageAssignmentsApi,
  getAdminPackageFormOptionsApi,
  getAdminPackagesApi,
  getAdminTrainersApi,
  updateAdminPackageApi,
} from "@/lib/mobile-api";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { packageTypeLabel } from "@/lib/labels";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { SelectionChip } from "@/theme/components/selection-chip";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { StyleSheet, Text, TextInput, View, Pressable, Alert } from "react-native";
import { tokens } from "@/theme/tokens";

type LessonVariant = {
  key: string;
  categoryKey: string;
  categoryLabel: string;
  label: string;
  packageType: string;
  isTrial?: boolean;
};

const LESSON_VARIANTS: LessonVariant[] = [
  { key: "PT", categoryKey: "PT", categoryLabel: "PT", label: "Kişisel Antrenman", packageType: "PT" },
  { key: "SCOLIOSIS", categoryKey: "REHAB", categoryLabel: "Rehabilitasyon", label: "Skolyoz", packageType: "SCOLIOSIS" },
  { key: "POSTURE", categoryKey: "REHAB", categoryLabel: "Rehabilitasyon", label: "Postür ve Denge", packageType: "OTHER" },
  { key: "MANUAL", categoryKey: "REHAB", categoryLabel: "Rehabilitasyon", label: "Manuel Terapi", packageType: "MANUAL" },
  { key: "REFORMER", categoryKey: "PILATES", categoryLabel: "Pilates", label: "Reformer Pilates", packageType: "REFORMER" },
  { key: "PILATES", categoryKey: "PILATES", categoryLabel: "Pilates", label: "Pilates", packageType: "OTHER" },
  { key: "PILATES_YOGA", categoryKey: "PILATES", categoryLabel: "Pilates", label: "Pilates Yoga", packageType: "OTHER" },
  { key: "CLINICAL_PILATES", categoryKey: "PILATES", categoryLabel: "Pilates", label: "Klinik Pilates", packageType: "OTHER" },
  { key: "STANDARD", categoryKey: "STANDARD", categoryLabel: "Standart", label: "Standart Paket", packageType: "OTHER" },
  { key: "FREE_TRIAL", categoryKey: "FREE", categoryLabel: "Ücretsiz", label: "Ücretsiz Ders", packageType: "OTHER", isTrial: true },
];

const LESSON_CATEGORIES = Array.from(
  new Map(
    LESSON_VARIANTS.map((item) => [item.categoryKey, { key: item.categoryKey, label: item.categoryLabel }])
  ).values()
);
const DEFAULT_SESSION_DURATION = 45;

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(",", ".");
  const [integerPart = "", decimalPart = ""] = normalized.split(".");
  const safeInteger = integerPart.replace(/[^\d]/g, "");
  const safeDecimal = decimalPart.replace(/[^\d]/g, "").slice(0, 2);
  return safeDecimal ? `${safeInteger}.${safeDecimal}` : safeInteger;
}

function toTestIdSegment(value: string) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function templateTypeLabel(template?: AdminPackageFormTemplate | null) {
  const type = String(template?.package_type || "").toUpperCase();
  if (template?.package_type_label) return String(template.package_type_label);
  return packageTypeLabel(template?.sub_category_key || template?.service_key || type);
}

function categoryKeyForTemplate(template: AdminPackageFormTemplate) {
  return (
    String(template.category_group || "").trim() ||
    String(template.package_type || "OTHER").trim() ||
    "OTHER"
  );
}

function categoryLabelFromKey(key: string, explicitLabel?: string | null) {
  if (explicitLabel && String(explicitLabel).trim()) return String(explicitLabel).trim();
  return String(key || "OTHER")
    .replace(/_/g, " ")
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase("tr-TR"));
}

function lessonModeLabel(mode?: string | null) {
  const normalized = String(mode || "").toUpperCase();
  if (normalized === "GROUP") return "Grup";
  if (normalized === "DUO") return "Duo";
  return "Özel";
}

function capacityForLessonMode(mode: string, fallback: number) {
  if (mode === "PRIVATE") return 1;
  if (mode === "DUO") return 2;
  return Math.max(3, fallback || 4);
}

function templateDefaultTitle(template?: AdminPackageFormTemplate | null) {
  if (!template) return "";
  return String(template.default_title || (template.service_name ? `${template.service_name} Paketi` : "")).trim();
}

function templateDisplayName(template: AdminPackageFormTemplate) {
  return String(template.sub_category_label || template.service_name || template.service_key || "").trim();
}

function templateLooksLikeTrial(template?: AdminPackageFormTemplate | null) {
  if (!template) return false;
  const search = normalizeText(`${template.service_key} ${template.service_name} ${template.starting_price}`);
  return Number(template.starting_price || 0) === 0 || search.includes("ucretsiz") || search.includes("deneme");
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function findBestTemplateForVariant(
  variantKey: string,
  templates: AdminPackageFormTemplate[]
): AdminPackageFormTemplate | null {
  const variant = LESSON_VARIANTS.find((item) => item.key === variantKey);
  if (!variant || templates.length === 0) return templates[0] || null;
  const byType = templates.filter((item) => String(item.package_type || "").toUpperCase() === variant.packageType);
  const pool = byType.length > 0 ? byType : templates;
  const label = normalizeText(variant.label);
  return (
    pool.find((item) => normalizeText(String(item.service_name || "")).includes(label)) ||
    pool.find((item) => label.includes(normalizeText(String(item.service_name || "")))) ||
    pool[0] ||
    null
  );
}

function deriveWeeklyRuleSummary(totalCreditsRaw: string) {
  const totalCredits = Number(totalCreditsRaw || 0);
  if (!Number.isFinite(totalCredits) || totalCredits <= 0) {
    return null;
  }

  const weeklyClassHours = Math.min(7, Math.max(1, Math.round(totalCredits / 4)));
  const requiredPreferenceSlots = weeklyClassHours * 3;
  const requiredTrainerFreeSlots = weeklyClassHours * 2;

  return {
    weeklyClassHours,
    requiredPreferenceSlots,
    requiredTrainerFreeSlots,
  };
}

function buildVariantDefaults(
  variant: LessonVariant | undefined,
  template: AdminPackageFormTemplate | null
) {
  const isGroup = variant?.packageType === "GROUP";
  return {
    total_credits: isGroup ? "8" : "4",
    duration_days: "30",
    display_price: sanitizeDecimalInput(String(template?.starting_price || (isGroup ? "200" : "0"))),
    trainer_commission_rate: sanitizeDecimalInput(String(template?.trainer_commission_rate || "25")),
    capacity: String(template?.suggested_capacity || (isGroup ? 4 : 1)),
    session_duration_minutes: String(template?.session_duration_minutes || DEFAULT_SESSION_DURATION),
    break_duration_minutes: String(template?.break_duration_minutes || 0),
    lesson_mode: template?.lesson_mode || (isGroup ? "GROUP" : "PRIVATE"),
  };
}

export default function AdminPackagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[]; subscriptionBackTo?: string | string[] }>();
  const packagesQuery = useQuery({ queryKey: ["admin-packages"], queryFn: getAdminPackagesApi });
  const templatesQuery = useQuery({ queryKey: ["admin-package-templates"], queryFn: getAdminPackageFormOptionsApi });
  const trainersQuery = useQuery({ queryKey: ["admin-trainers-for-packages"], queryFn: getAdminTrainersApi });
  const assignmentsQuery = useQuery({ queryKey: ["admin-package-assignments"], queryFn: getAdminPackageAssignmentsApi });

  const templates: AdminPackageFormTemplate[] = useMemo(
    () => (Array.isArray(templatesQuery.data?.templates) ? templatesQuery.data?.templates || [] : []),
    [templatesQuery.data?.templates]
  );
  const templateCategories = useMemo(() => {
  const map = new Map<string, { key: string; label: string }>();

    for (const template of templates) {
      const key = categoryKeyForTemplate(template);
      const label = categoryLabelFromKey(key, template.category_label);

      map.set(key, { key, label });
    }

    return Array.from(map.values());
  }, [templates]);

  const effectiveCategories = templateCategories.length > 0 ? templateCategories : LESSON_CATEGORIES;
  const trainers = useMemo(() => trainersQuery.data || [], [trainersQuery.data]);
  const packages: AdminPackage[] = useMemo(() => packagesQuery.data || [], [packagesQuery.data]);
  const assignments: AdminPackageAssignment[] = assignmentsQuery.data || [];

  const [selectedService, setSelectedService] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [serviceSheetVisible, setServiceSheetVisible] = useState(false);
  const [trainerSheetVisible, setTrainerSheetVisible] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>("");
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    total_credits: "",
    duration_days: "",
    display_price: "",
    trainer_commission_rate: "",
    capacity: "",
    summary: "",
    lesson_mode: "PRIVATE",
    is_visible: true,
    is_public: true,
  });

  const selectedTemplate = useMemo(() => templates.find((item: AdminPackageFormTemplate) => item.service_key === selectedService) || null, [selectedService, templates]);
  const selectedVariant = LESSON_VARIANTS.find((item) => item.key === selectedVariantKey) || null;
  const selectedCategoryLabel = useMemo(() => {
    if (selectedTemplate) return categoryLabelFromKey(categoryKeyForTemplate(selectedTemplate), selectedTemplate.category_label);
    if (selectedVariant) return selectedVariant.categoryLabel;
    return effectiveCategories.find((item) => item.key === selectedCategoryKey)?.label || "Kategori seç";
  }, [effectiveCategories, selectedCategoryKey, selectedTemplate, selectedVariant]);
  const isTrialPackage = Boolean(selectedVariant?.isTrial || templateLooksLikeTrial(selectedTemplate));
  const visibleTemplateVariants = useMemo(() => {
    return templates.filter((template) => {
      return categoryKeyForTemplate(template) === selectedCategoryKey;
    });
  }, [selectedCategoryKey, templates]);

  const visibleVariants = useMemo(
    () => LESSON_VARIANTS.filter((item) => item.categoryKey === selectedCategoryKey),
    [selectedCategoryKey]
  );
  const selectedTrainer = useMemo(() => {
    return trainers.find((trainer: any) => String(trainer.id || trainer.user_id || "") === selectedTrainerId) || null;
  }, [selectedTrainerId, trainers]);
  const selectedServiceLabel = selectedTemplate ? templateDisplayName(selectedTemplate) : selectedVariant?.label || "Ders seç";
  const weeklyRuleSummary = useMemo(() => deriveWeeklyRuleSummary(form.total_credits), [form.total_credits]);
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const subscriptionBackTo = Array.isArray(params.subscriptionBackTo) ? params.subscriptionBackTo[0] : params.subscriptionBackTo;
  const filteredPackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
        const searchOk =
          !normalizedSearch ||
          String(pkg.title || "").toLocaleLowerCase("tr-TR").includes(normalizedSearch) ||
          String(pkg.service_name || "").toLocaleLowerCase("tr-TR").includes(normalizedSearch);
        const statusOk = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? pkg.is_active : !pkg.is_active);
        return searchOk && statusOk;
      }),
    [packages, search, statusFilter]
  );

  useEffect(() => {
    if (!selectedCategoryKey && effectiveCategories.length > 0) {
      setSelectedCategoryKey(effectiveCategories[0].key);
      return;
    }
    if (selectedCategoryKey && effectiveCategories.length > 0 && !effectiveCategories.some((item) => item.key === selectedCategoryKey)) {
      setSelectedCategoryKey(effectiveCategories[0].key);
      return;
    }
    if (!selectedTemplate && templates.length > 0) {
      const fallback = findBestTemplateForVariant(selectedVariantKey, templates);
      if (fallback) {
        setSelectedService(fallback.service_key);
        setSelectedVariantKey(fallback.service_key);
        setSelectedCategoryKey(categoryKeyForTemplate(fallback));
      }
    }
  }, [effectiveCategories, selectedCategoryKey, selectedTemplate, selectedVariantKey, templates]);

  useEffect(() => {
    if (!selectedTemplate || editingPackageId) return;

    setForm((prev) => {
      const lessonMode = String(selectedTemplate.lesson_mode || "PRIVATE").toUpperCase();
      const capacity = String(capacityForLessonMode(lessonMode, Number(selectedTemplate.suggested_capacity || 1)));
      const next = {
        ...prev,
        total_credits: prev.total_credits || (lessonMode === "GROUP" ? "8" : "4"),
        duration_days: prev.duration_days || "30",
        display_price: prev.display_price || sanitizeDecimalInput(String(selectedTemplate.starting_price || "0")),
        trainer_commission_rate:
          prev.trainer_commission_rate || sanitizeDecimalInput(String(selectedTemplate.trainer_commission_rate || "25")),
        capacity: prev.capacity || capacity,
        lesson_mode: prev.lesson_mode || lessonMode,
      };

      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [editingPackageId, selectedTemplate]);

  function resetForm() {
    setEditingPackageId(null);
    setSelectedTrainerId("");
    setSelectedCategoryKey(effectiveCategories[0]?.key || LESSON_CATEGORIES[0]?.key || "PT");
    setSelectedVariantKey("");
    setForm({
      title: "",
      total_credits: "",
      duration_days: "",
      display_price: "",
      trainer_commission_rate: "",
      capacity: "",
      summary: "",
      lesson_mode: "PRIVATE",
      is_visible: true,
      is_public: true,
    });
  }

  function applyTemplateSelection(template: AdminPackageFormTemplate) {
    const lessonMode = String(template.lesson_mode || "PRIVATE").toUpperCase();
    const capacity = capacityForLessonMode(lessonMode, Number(template.suggested_capacity || 1));

    setSelectedService(template.service_key);
    setSelectedVariantKey(template.service_key);
    setSelectedCategoryKey(categoryKeyForTemplate(template));
    setForm((prev) => ({
      ...prev,
      title: templateDefaultTitle(template) || prev.title,
      total_credits: prev.total_credits || (lessonMode === "GROUP" ? "8" : "4"),
      duration_days: prev.duration_days || "30",
      display_price: sanitizeDecimalInput(String(template.starting_price || "0")),
      trainer_commission_rate: sanitizeDecimalInput(String(template.trainer_commission_rate || "25")),
      capacity: String(capacity),
      lesson_mode: lessonMode,
      summary: prev.summary,
    }));
    setServiceSheetVisible(false);
  }

  function applyVariantSelection(variantKey: string) {
    const variant = LESSON_VARIANTS.find((item) => item.key === variantKey);
    const template = findBestTemplateForVariant(variantKey, templates);
    if (template) {
      applyTemplateSelection(template);
      return;
    }
    const defaults = buildVariantDefaults(variant, template);
    if (variant) {
      setSelectedCategoryKey(variant.categoryKey);
    }
    setSelectedVariantKey(variantKey);
    setForm((prev) => ({
      ...prev,
      total_credits: prev.total_credits || defaults.total_credits,
      duration_days: prev.duration_days || defaults.duration_days,
      display_price: prev.display_price || defaults.display_price,
      trainer_commission_rate: prev.trainer_commission_rate || defaults.trainer_commission_rate,
      capacity: prev.capacity || defaults.capacity,
      lesson_mode: defaults.lesson_mode,
    }));
    setServiceSheetVisible(false);
    setTimeout(() => setServiceSheetVisible(false), 0);
  }

  const saveMutation = useMutation({
  mutationFn: async () => {
    if (!selectedService) throw new Error("Önce ders türü seçmelisin.");
    if (!form.title.trim()) throw new Error("Paket adı zorunlu.");
    if (!form.total_credits.trim()) throw new Error("Ders hakkı zorunlu.");
    if (!form.duration_days.trim()) throw new Error("Geçerlilik süresi zorunlu.");
    if (!form.display_price.trim()) throw new Error("Paket fiyatı zorunlu.");
    if (!form.trainer_commission_rate.trim()) throw new Error("Eğitmen komisyonu zorunlu.");
    if (!form.capacity.trim()) throw new Error("Kapasite zorunlu.");
    const lessonMode = String(form.lesson_mode || selectedTemplate?.lesson_mode || "PRIVATE").toUpperCase();

    if (editingPackageId) {
      return updateAdminPackageApi(editingPackageId, {
        title: form.title.trim(),
        total_credits: Number(form.total_credits) || 1,
        duration_days: Number(form.duration_days) || 0,
        service_key: selectedService,
        display_price: Number(form.display_price || 0),
        trainer_commission_rate: Number(form.trainer_commission_rate || 0),
        capacity: Number(form.capacity || 1),
        summary: form.summary.trim(),
        sub_lessons: selectedTemplate?.sub_lessons || [],
        session_duration_minutes: selectedTemplate?.session_duration_minutes || DEFAULT_SESSION_DURATION,
        break_duration_minutes: selectedTemplate?.break_duration_minutes || 0,
        lesson_mode: lessonMode,
        is_visible: form.is_visible,
        is_public: form.is_public,
      });
    }

    const created = await createAdminPackageApi({
      title: form.title.trim(),
      total_credits: Number(form.total_credits) || 1,
      duration_days: Number(form.duration_days) || 0,
      service_key: selectedService,
      display_price: Number(form.display_price || 0),
      trainer_commission_rate: Number(form.trainer_commission_rate || 0),
      capacity: Number(form.capacity || 1),
      summary: form.summary.trim(),
      sub_lessons: selectedTemplate?.sub_lessons || [],
      session_duration_minutes: selectedTemplate?.session_duration_minutes || DEFAULT_SESSION_DURATION,
      break_duration_minutes: selectedTemplate?.break_duration_minutes || 0,
      lesson_mode: lessonMode,
      is_active: true,
      is_visible: form.is_visible,
      is_public: form.is_public,
    });

    if (!created?.id) throw new Error("Paket oluşturulamadı.");

    if (selectedTrainerId) {
      await createAdminPackageAssignmentApi({
        package_id: created.id,
        trainer_id: selectedTrainerId,
      });
    }

    return created;
  },

  meta: {
  invalidates: [
    ["admin-packages"],
    ["admin-package-assignments"],
    ["admin-package-templates"],

    ["member-packages"],
    ["member-my-packages"],
    ["member-my-packages-list"],
    ["public-salon-packages"],
    ["publıc-salon-packages"],

    ["trainer-assigned-packages"],
    ["trainer-booking-form-options"],
    ["salon-trainer-options"],
  ],
},

  onSuccess: () => {
    showInfoAlert(
      editingPackageId ? "Paket güncellendi" : "Paket oluşturuldu",
      editingPackageId
        ? "Paket bilgileri güncellendi."
        : selectedTrainerId
          ? "Paket oluşturuldu ve seçili eğitmene atandı."
          : "Paket oluşturuldu."
    );

    resetForm();
  },

  onError: (error) => {
    showErrorAlert(
      editingPackageId ? "Paket güncellenemedi" : "Paket oluşturulamadı",
      error,
      "Paket bilgileri kaydedilemedi."
    );
  },
});

  const statusMutation = useMutation({
  mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
    updateAdminPackageApi(id, { is_active }),

   meta: {
    invalidates: [
    ["admin-packages"],
    ["admin-package-assignments"],
    ["admin-package-templates"],

    ["member-packages"],
    ["member-my-packages"],
    ["public-salon-packages"],
    ["publıc-salon-packages"],

    ["trainer-assigned-packages"],
    ["trainer-booking-form-options"],
    ["salon-trainer-options"],
  ],
},

  onSuccess: (_response, variables) => {
    showInfoAlert(
      variables.is_active ? "Paket aktifleştirildi" : "Paket pasife alındı",
      "Paket durumu güncellendi."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Paket durumu güncellenemedi",
      error,
      "İşlem tamamlanamadı."
    );
  },
});

 const assignmentMutation = useMutation({
  mutationFn: async (
    payload:
      | { mode: "add"; package_id: string; trainer_id: string }
      | { mode: "remove"; id: string }
  ) => {
    if (payload.mode === "add") {
      return createAdminPackageAssignmentApi({
        package_id: payload.package_id,
        trainer_id: payload.trainer_id,
      });
    }

    return deleteAdminPackageAssignmentApi(payload.id);
  },

  meta: {
  invalidates: [
    ["admin-packages"],
    ["admin-package-assignments"],
    ["admin-package-templates"],

    ["member-packages"],
    ["member-my-packages"],
    ["public-salon-packages"],
    ["publıc-salon-packages"],

    ["trainer-assigned-packages"],
    ["trainer-booking-form-options"],
    ["salon-trainer-options"],
  ],
},

  onSuccess: () => {
    showInfoAlert(
      "Eğitmen ataması güncellendi",
      "Paketin eğitmen bağlantısı güncellendi."
    );
  },

  onError: (error) => {
    showErrorAlert(
      "Eğitmen ataması güncellenemedi",
      error,
      "İşlem tamamlanamadı."
    );
  },
});

  const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAdminPackageApi(id),

  meta: {
  invalidates: [
    ["admin-packages"],
    ["admin-package-assignments"],
    ["admin-package-templates"],

    ["member-packages"],
    ["member-my-packages"],
    ["member-my-packages-list"],
    ["public-salon-packages"],
    ["publıc-salon-packages"],

    ["trainer-assigned-packages"],
    ["trainer-booking-form-options"],
    ["salon-trainer-options"],
  ],
},

  onSuccess: () => {
    showInfoAlert("Paket silindi", "Paket kaydı kaldırıldı.");

    if (editingPackageId) {
      resetForm();
    }
  },

  onError: (error) => {
    showErrorAlert(
      "Paket silinemedi",
      error,
      "Paket silme işlemi tamamlanamadı."
    );
  },
});

  function handleEditPackage(pkg: AdminPackage) {
    setEditingPackageId(pkg.id);
    setSelectedService(String(pkg.service_key || ""));
    const matchedTemplate = templates.find((item) => item.service_key === pkg.service_key);
    const matchedVariant =
      LESSON_VARIANTS.find((item) => normalizeText(String(pkg.service_name || pkg.title || "")).includes(normalizeText(item.label))) ||
      LESSON_VARIANTS.find((item) => item.isTrial && Number(pkg.display_price || 0) === 0 && Number(pkg.total_credits || 0) === 1) ||
      LESSON_VARIANTS.find((item) => item.packageType === String(pkg.type || "").toUpperCase()) ||
      LESSON_VARIANTS.find((item) => item.key === "STANDARD");
    setSelectedCategoryKey(matchedTemplate ? categoryKeyForTemplate(matchedTemplate) : matchedVariant?.categoryKey || "STANDARD");
    setSelectedVariantKey(matchedTemplate?.service_key || matchedVariant?.key || "STANDARD");
    const firstAssignment = assignments.find((item) => item.package_id === pkg.id && item.is_active !== false);
    setSelectedTrainerId(firstAssignment?.trainer_id || "");
    setForm({
      title: String(pkg.title || ""),
      total_credits: String(pkg.total_credits || 1),
      duration_days: String(pkg.duration_days || 0),
      display_price: String(pkg.display_price || 0),
      trainer_commission_rate: String(Number(pkg.trainer_commission_rate || 0)),
      capacity: String(pkg.capacity || 1),
      summary: String(pkg.summary || ""),
      lesson_mode: String(pkg.lesson_mode || "PRIVATE").toUpperCase(),
      is_visible: pkg.is_visible !== false,
      is_public: Boolean(pkg.is_public),
    });
  }

  function confirmDeletePackage(pkg: AdminPackage) {
    Alert.alert("Paketi sil", `"${pkg.title}" kalıcı olarak silinecek.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => deleteMutation.mutate(pkg.id),
      },
    ]);
  }

  return (
    <AppShell
      title="Paketler"
      subtitle="Paket oluştur, fiyat ve komisyon belirle, ardından paketi eğitmene bağla. Ücretsiz deneme dersi paketi de buradan açılır."
      icon="package"
      refreshing={packagesQuery.isRefetching}
      onRefresh={() => void packagesQuery.refetch()}
      onBack={
        backTo
          ? () =>
              router.replace({
                pathname: backTo,
                params: backTo === "/(admin)/subscription" && subscriptionBackTo ? { backTo: subscriptionBackTo } : undefined,
              } as never)
          : undefined
      }
    >
      <SurfaceCard tone="primary">
        <Text style={styles.title}>Paket yönetimi</Text>
        <Text style={styles.copy}>Katalogdan ana kategori ve alt kategoriyi seç; fiyat, kapasite ve komisyon otomatik gelsin, gerektiğinde düzenle.</Text>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>{editingPackageId ? "Paketi düzenle" : "Yeni paket oluştur"}</Text>
        <Text style={styles.copy}>{editingPackageId ? "Seçili paketin satış bilgilerini güncelle." : "Satışa hazır paket bilgilerini tek ekrandan tamamla."}</Text>

        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>1. Ders türünü seç</Text>
          <Pressable testID="admin-package-category-picker" style={styles.dropdownField} onPress={() => setServiceSheetVisible(true)}>
            <View style={styles.dropdownFieldCopy}>
              <Text style={styles.dropdownFieldCaption}>Kategori</Text>
              <Text style={styles.dropdownFieldValue}>{selectedCategoryLabel}</Text>
            </View>
            <Text style={styles.dropdownFieldChevron}>▾</Text>
          </Pressable>
          <Pressable testID="admin-package-variant-picker" style={styles.dropdownField} onPress={() => setServiceSheetVisible(true)}>
            <View style={styles.dropdownFieldCopy}>
              <Text style={styles.dropdownFieldCaption}>Alt tür</Text>
              <Text style={styles.dropdownFieldValue}>{selectedServiceLabel}</Text>
            </View>
            <Text style={styles.dropdownFieldChevron}>▾</Text>
          </Pressable>
          <Text style={styles.selectorMeta}>
            {selectedTemplate ? `${templateTypeLabel(selectedTemplate)} • ${lessonModeLabel(form.lesson_mode)} • ${selectedTemplate.capacity_label || "Kapasite ayarlanır"}` : "Kategori ve alt kategori seçmek için dokun."}
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Paket bilgileri</Text>
          <View style={styles.formCard}>
            <FormField inputId="admin-package-title-input" label="Paket adı" value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="Paket adını gir" />
            <FormField inputId="admin-package-credits-input" label="Ders hakkı" value={form.total_credits} onChangeText={(value) => setForm((prev) => ({ ...prev, total_credits: sanitizeIntegerInput(value) }))} placeholder="Ders hakkı" keyboardType="number-pad" />
            <FormField inputId="admin-package-duration-input" label="Geçerlilik süresi" value={form.duration_days} onChangeText={(value) => setForm((prev) => ({ ...prev, duration_days: sanitizeIntegerInput(value) }))} placeholder="Gün sayısı" keyboardType="number-pad" />
            <FormField inputId="admin-package-price-input" label="Paket fiyatı" value={form.display_price} onChangeText={(value) => setForm((prev) => ({ ...prev, display_price: sanitizeDecimalInput(value) }))} placeholder="Fiyat" keyboardType="decimal-pad" />
            <FormField inputId="admin-package-commission-input" label="Komisyon (%)" value={form.trainer_commission_rate} onChangeText={(value) => setForm((prev) => ({ ...prev, trainer_commission_rate: sanitizeDecimalInput(value) }))} placeholder="Komisyon oranı" keyboardType="decimal-pad" />
            <View style={styles.modePanel}>
              <Text style={styles.selectorLabel}>Kapasite tipi</Text>
              <View style={styles.chipRow}>
                {[
                  { value: "PRIVATE", label: "Özel", capacity: 1 },
                  { value: "DUO", label: "Duo", capacity: 2 },
                  { value: "GROUP", label: "Grup", capacity: Math.max(3, Number(form.capacity || selectedTemplate?.suggested_capacity || 4)) },
                ].map((option) => (
                  <SelectionChip
                    key={option.value}
                    label={option.label}
                    active={form.lesson_mode === option.value}
                    onPress={() =>
                      setForm((prev) => ({
                        ...prev,
                        lesson_mode: option.value,
                        capacity: String(capacityForLessonMode(option.value, option.capacity)),
                      }))
                    }
                  />
                ))}
              </View>
            </View>
            <FormField inputId="admin-package-capacity-input" label="Kişi kapasitesi" value={form.capacity} onChangeText={(value) => setForm((prev) => ({ ...prev, capacity: sanitizeIntegerInput(value) }))} placeholder="Kapasite" keyboardType="number-pad" />
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Planlama özeti</Text>
              <Text style={styles.previewText}>
                {lessonModeLabel(form.lesson_mode)} akış • {form.capacity || 1} kişi • {selectedTemplate?.session_duration_minutes || DEFAULT_SESSION_DURATION} dk ders
              </Text>
              {weeklyRuleSummary ? (
                <Text style={styles.previewText}>
                  Haftada {weeklyRuleSummary.weeklyClassHours} ders • {weeklyRuleSummary.requiredPreferenceSlots} slot seçilir • {weeklyRuleSummary.requiredTrainerFreeSlots} eğitmen boşluğu gerekir
                </Text>
              ) : null}
            </View>
            <View style={styles.modePanel}>
              <Text style={styles.selectorLabel}>Üye görünürlüğü</Text>
              <View style={styles.chipRow}>
                <SelectionChip
                  label="Onboarding'de göster"
                  active={form.is_public}
                  onPress={() => setForm((prev) => ({ ...prev, is_public: !prev.is_public }))}
                />
                <SelectionChip
                  label="Üye panelinde göster"
                  active={form.is_visible}
                  onPress={() => setForm((prev) => ({ ...prev, is_visible: !prev.is_visible }))}
                />
              </View>
              <Text style={styles.previewText}>
                Onboarding ekranında yalnız adminin burada yayına açtığı paketler görünür.
              </Text>
            </View>
            <FormField
              inputId="admin-package-summary-input"
              label="Paket açıklaması"
              value={form.summary}
              onChangeText={(value) => setForm((prev) => ({ ...prev, summary: value }))}
              placeholder="Kısa açıklama"
              multiline
              numberOfLines={4}
              returnKeyType="done"
              blurOnSubmit
            />
          </View>
        </View>

        <Text style={styles.sectionSub}>Eğitmen ataması</Text>
        <Pressable style={styles.dropdownField} onPress={() => setTrainerSheetVisible(true)}>
          <View style={styles.dropdownFieldCopy}>
            <Text style={styles.dropdownFieldCaption}>Eğitmen</Text>
            <Text style={styles.dropdownFieldValue}>
              {selectedTrainer
                ? `${selectedTrainer.first_name || ""} ${selectedTrainer.last_name || ""}`.trim() || selectedTrainer.email || "Eğitmen"
                : "Sonra atarım"}
            </Text>
          </View>
          <Text style={styles.dropdownFieldChevron}>▾</Text>
        </Pressable>

        {editingPackageId ? (
          <View style={styles.assignmentEditor}>
            <Text style={styles.assignmentEditorTitle}>Mevcut eğitmen atamaları</Text>
            <View style={styles.assignmentChipWrap}>
              {assignments
                .filter((item) => item.package_id === editingPackageId && item.is_active !== false)
                .map((item) => (
                  <ActionButton
                    key={item.id}
                    label={`${item.trainer_full_name || item.trainer_email || "Eğitmen"} kaldır`}
                    icon="risk"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() => assignmentMutation.mutate({ mode: "remove", id: item.id })}
                    loading={assignmentMutation.isPending}
                  />
                ))}
            </View>
            <ActionButton
              label="Seçili eğitmeni ekle"
              icon="trainer"
              variant="ghost"
              onPress={() => {
                if (!selectedTrainerId || !editingPackageId) return;
                assignmentMutation.mutate({ mode: "add", package_id: editingPackageId, trainer_id: selectedTrainerId });
              }}
              disabled={!selectedTrainerId}
              loading={assignmentMutation.isPending}
            />
          </View>
        ) : null}

        <ActionButton testID="admin-package-save-button" label={editingPackageId ? "Değişiklikleri kaydet" : isTrialPackage ? "Deneme paketini oluştur" : "Paketi oluştur"} icon="package" onPress={() => saveMutation.mutate()} loading={saveMutation.isPending} />
        {editingPackageId ? <ActionButton testID="admin-package-cancel-button" label="Düzenlemeyi iptal et" icon="arrow-left" variant="ghost" onPress={resetForm} /> : null}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Paket listesi</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Paket veya ders türü ara"
          placeholderTextColor={tokens.colors.textMuted}
          style={styles.searchInput}
        />
        <View style={styles.chipRow}>
          <SelectionChip label="Tümü" active={statusFilter === "ALL"} onPress={() => setStatusFilter("ALL")} />
          <SelectionChip label="Aktif" active={statusFilter === "ACTIVE"} onPress={() => setStatusFilter("ACTIVE")} />
          <SelectionChip label="Pasif" active={statusFilter === "PASSIVE"} onPress={() => setStatusFilter("PASSIVE")} />
        </View>
        <View style={styles.list}>
          {filteredPackages.map((pkg) => {
            const packageAssignments = assignments.filter((item: AdminPackageAssignment) => item.package_id === pkg.id && item.is_active !== false);
            return (
              <View key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <View style={styles.packageCopy}>
                    <Text style={styles.packageTitle}>{pkg.title}</Text>
                    <Text style={styles.packageMeta}>{pkg.pricing_label || `${pkg.display_price || 0} TL`} • %{Number(pkg.trainer_commission_rate || 0).toFixed(0)} komisyon</Text>
                  </View>
                  <Text style={styles.packageType}>{pkg.is_active ? (pkg.is_public ? "Yayında" : "Dahili") : "Pasif"}</Text>
                </View>
                <Text style={styles.packageBody}>{pkg.summary || "Açıklama girilmedi."}</Text>
                <Text style={styles.packageHint}>Ders hakkı: {pkg.total_credits} • Süre: {pkg.duration_days || 0} gün • Ders türü: {pkg.service_name || pkg.lesson_category || "-"}</Text>
                <Text style={styles.packageHint}>
                  Akış: {pkg.lesson_mode === "GROUP" ? "Grup" : pkg.lesson_mode === "DUO" ? "Duo" : "Özel"}
                </Text>
                <Text style={styles.assignmentLabel}>
                  Atanan eğitmenler: {packageAssignments.length > 0 ? packageAssignments.map((item) => item.trainer_full_name || item.trainer_email || "Eğitmen").join(", ") : "Henüz atanmadı"}
                </Text>
                <View style={styles.actionRow}>
                  <ActionButton
                    testID={`admin-package-edit-${toTestIdSegment(pkg.title || pkg.id)}`}
                    label="Düzenle"
                    icon="notes"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() => handleEditPackage(pkg)}
                  />
                  <ActionButton
                    testID={`admin-package-toggle-status-${toTestIdSegment(pkg.title || pkg.id)}`}
                    label={pkg.is_active ? "Pasife al" : "Aktifleştir"}
                    icon={pkg.is_active ? "risk" : "spark"}
                    variant={pkg.is_active ? "danger" : "ghost"}
                    fullWidth={false}
                    onPress={() => statusMutation.mutate({ id: pkg.id, is_active: !pkg.is_active })}
                    loading={statusMutation.isPending}
                  />
                  <ActionButton
                    testID={`admin-package-delete-${toTestIdSegment(pkg.title || pkg.id)}`}
                    label="Sil"
                    icon="risk"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() => confirmDeletePackage(pkg)}
                    loading={deleteMutation.isPending}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      <DetailSheet
        visible={serviceSheetVisible}
        onClose={() => setServiceSheetVisible(false)}
        title="Paket türü seç"
        subtitle="Önce ana kategoriyi, ardından paket alt kategorisini seç."
      >
        <View style={styles.sheetCategoryRow}>
          {effectiveCategories.map((category) => (
            <SelectionChip
              key={category.key}
              testID={`admin-package-category-${toTestIdSegment(category.label)}`}
              label={category.label}
              active={selectedCategoryKey === category.key}
              onPress={() => setSelectedCategoryKey(category.key)}
            />
          ))}
        </View>
        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionTitle}>Alt kategori</Text>
         {visibleTemplateVariants.length > 0
  ? visibleTemplateVariants.map((template) => (
      <Pressable
        key={template.service_key}
        testID={`admin-package-variant-${toTestIdSegment(templateDisplayName(template) || template.service_key)}`}
        style={[styles.sheetOption, selectedService === template.service_key ? styles.sheetOptionActive : null]}
        onPress={() => applyTemplateSelection(template)}
      >
        <Text style={styles.sheetOptionTitle}>{templateDisplayName(template) || template.service_key}</Text>
        <Text style={styles.sheetOptionMeta}>
          {templateTypeLabel(template)} • {lessonModeLabel(template.lesson_mode)} •{" "}
          {template.capacity_label || "Kapasite ayarlanır"} •{" "}
          {template.starting_price ? `${template.starting_price} TL` : "Fiyat ayarlanır"}
        </Text>
      </Pressable>
    ))
  : visibleVariants.map((item) => {
      const template = findBestTemplateForVariant(item.key, templates);
      return (
        <Pressable
          key={item.key}
          testID={`admin-package-variant-${toTestIdSegment(item.label)}`}
          style={[styles.sheetOption, selectedVariantKey === item.key ? styles.sheetOptionActive : null]}
          onPress={() => applyVariantSelection(item.key)}
        >
          <Text style={styles.sheetOptionTitle}>{item.label}</Text>
          <Text style={styles.sheetOptionMeta}>
            {(template ? templateTypeLabel(template) : item.packageType)} • {template?.capacity_label || "Kapasite ayarlanır"} •{" "}
            {item.isTrial ? "0 TL" : template?.starting_price ? `${template.starting_price} TL` : "Fiyat ayarlanır"}
          </Text>
        </Pressable>
      );
    })}
        </View>
      </DetailSheet>

      <DetailSheet
        visible={trainerSheetVisible}
        onClose={() => setTrainerSheetVisible(false)}
        title="Eğitmen seç"
        subtitle="Paketi şimdi bir eğitmene bağlayabilir veya daha sonra atayabilirsin."
      >
        <Pressable
          style={[styles.sheetOption, !selectedTrainerId ? styles.sheetOptionActive : null]}
          onPress={() => {
            setSelectedTrainerId("");
            setTrainerSheetVisible(false);
          }}
        >
          <Text style={styles.sheetOptionTitle}>Sonra atarım</Text>
          <Text style={styles.sheetOptionMeta}>Paket önce oluşturulur, eğitmen bağlantısı daha sonra yapılır.</Text>
        </Pressable>
        {trainers.map((trainer: any) => {
          const trainerId = String(trainer.id || trainer.user_id || "");
          const label = `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email || "Eğitmen";
          return (
            <Pressable
              key={trainerId}
              style={[styles.sheetOption, selectedTrainerId === trainerId ? styles.sheetOptionActive : null]}
              onPress={() => {
                setSelectedTrainerId(trainerId);
                setTrainerSheetVisible(false);
              }}
            >
              <Text style={styles.sheetOptionTitle}>{label}</Text>
              <Text style={styles.sheetOptionMeta}>{trainer.email || "Eğitmen profili"}</Text>
            </Pressable>
          );
        })}
      </DetailSheet>
    </AppShell>
  );
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
  sectionSub: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
    marginTop: tokens.spacing.sm,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  selectorGroup: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  dropdownField: {
    minHeight: 56,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownFieldCopy: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    gap: 2,
  },
  selectorLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  dropdownFieldCaption: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  dropdownFieldValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  dropdownFieldChevron: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  selectorMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
    lineHeight: 18,
  },
  formSection: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  formSectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  formCard: {
    gap: tokens.spacing.md,
  },
  modePanel: {
    gap: tokens.spacing.xs,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.md,
  },
  previewCard: {
    gap: 4,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.md,
  },
  previewTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  previewText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
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
  list: {
    gap: tokens.spacing.md,
  },
  packageCard: {
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.md,
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  packageCopy: {
    flex: 1,
    gap: 2,
  },
  packageTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  packageMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  packageType: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  packageBody: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  packageHint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  assignmentLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  assignmentEditor: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  assignmentEditorTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  assignmentChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sheetOption: {
    gap: 4,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.md,
  },
  sheetOptionActive: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  sheetOptionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  sheetOptionMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  sheetCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sheetSection: {
    gap: tokens.spacing.sm,
  },
  sheetSectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
});
