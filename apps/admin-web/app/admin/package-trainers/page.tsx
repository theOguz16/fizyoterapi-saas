"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { AppIcon } from "@/components/ui/app-icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChevronDown, ChevronUp } from "lucide-react";
import { httpRequest } from "@/lib/http-client";

type LessonCatalogPackageType = "GROUP" | "PT" | "SCOLIOSIS" | "REFORMER" | "MANUAL" | "OTHER";

type LessonCatalogItem = {
  code: string;
  title: string;
  description: string;
  active: boolean;
  starting_price: string;
  trainer_commission_rate: string;
  capacity_label: string;
  package_type: LessonCatalogPackageType;
  category_group?: string | null;
  lesson_mode?: "PRIVATE" | "DUO" | "GROUP" | string | null;
  sub_lessons?: string[];
  session_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
};

type PackageRow = {
  id: string;
  title: string;
  type: string;
  total_credits: number;
  duration_days: number;
  display_price?: string | null;
  is_active: boolean;
  is_visible?: boolean;
  is_public?: boolean;
  service_name?: string | null;
  service_key?: string | null;
  lesson_category?: string | null;
  capacity_label?: string | null;
  pricing_label?: string | null;
  commission_label?: string | null;
  trainer_commission_rate?: number;
};

type TrainerRow = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  is_active: boolean;
};

type AssignmentRow = {
  id: string;
  package_id: string;
  trainer_id: string;
  is_active: boolean;
  package_title?: string | null;
  trainer_full_name?: string | null;
  trainer_email?: string | null;
  created_at: string;
};

type PackageCreateForm = {
  service_key: string;
  title: string;
  total_credits: string;
  duration_days: string;
  display_price: string;
  is_visible: boolean;
  is_public: boolean;
};

type PackageEditForm = {
  title: string;
  total_credits: string;
  duration_days: string;
  display_price: string;
  is_visible: boolean;
  is_public: boolean;
};

type SettingsPayload = {
  data?: {
    profile?: {
      services?: Array<{
        type?: string;
        code?: string;
        title?: string;
        desc?: string;
        description?: string;
        starting_price?: string;
        active?: boolean;
        trainer_commission_rate?: string | number;
        capacity_label?: string;
        package_type?: LessonCatalogPackageType;
        category_group?: string | null;
        lesson_mode?: string | null;
        sub_lessons?: string[];
        session_duration_minutes?: number | null;
        break_duration_minutes?: number | null;
      }>;
    };
  };
};

const PACKAGE_TYPE_OPTIONS: Array<{ value: LessonCatalogPackageType; label: string }> = [
  { value: "GROUP", label: "Grup Dersi" },
  { value: "PT", label: "PT" },
  { value: "SCOLIOSIS", label: "Skolyoz" },
  { value: "REFORMER", label: "Reformer" },
  { value: "MANUAL", label: "Manuel" },
  { value: "OTHER", label: "Diğer" },
];

const CATALOG_PRESET_OPTIONS = [
  {
    key: "GROUP",
    label: "Grup Dersi",
    patch: {
      title: "Grup Dersi",
      description: "Genel kondisyon ve grup egzersizi",
      starting_price: "200",
      trainer_commission_rate: "25",
      capacity_label: "4-8 kişi",
      package_type: "GROUP" as LessonCatalogPackageType,
    },
  },
  {
    key: "PT",
    label: "Kişisel Antrenman (PT)",
    patch: {
      title: "Kişisel Antrenman (PT)",
      description: "Birebir kişiye özel egzersiz",
      starting_price: "500",
      trainer_commission_rate: "25",
      capacity_label: "1 kişi",
      package_type: "PT" as LessonCatalogPackageType,
    },
  },
  {
    key: "PILATES",
    label: "Pilates",
    patch: {
      title: "Pilates",
      description: "Core, nefes ve postür odaklı çalışma",
      starting_price: "700",
      trainer_commission_rate: "25",
      capacity_label: "1-2 kişi",
      package_type: "OTHER" as LessonCatalogPackageType,
    },
  },
  {
    key: "STANDARD",
    label: "Standart Ders",
    patch: {
      title: "Standart Ders",
      description: "Genel üyelik akışına uygun standart ders paketi",
      starting_price: "300",
      trainer_commission_rate: "20",
      capacity_label: "1 kişi",
      package_type: "OTHER" as LessonCatalogPackageType,
    },
  },
  {
    key: "FREE",
    label: "Ücretsiz Ders",
    patch: {
      title: "Ücretsiz Tanıtım Dersi",
      description: "İlk deneyim ve tanıtım için ücretsiz ders",
      starting_price: "0",
      trainer_commission_rate: "0",
      capacity_label: "1 kişi",
      package_type: "OTHER" as LessonCatalogPackageType,
    },
  },
];

const CREDIT_PRESETS = ["4", "8", "12", "16"];
const DURATION_PRESETS = ["7", "30", "60", "90"];
const PRICE_PRESETS = ["0", "200", "500", "700", "1000"];

function normalizeCode(input: unknown) {
  return String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asNumericString(value: unknown, fallback: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed.toFixed(2);
}

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

function normalizeCatalog(raw: unknown): LessonCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, LessonCatalogItem>();

  for (const entry of raw) {
    const item = (entry || {}) as Record<string, unknown>;
    const code = normalizeCode(item.type || item.code || item.title);
    if (!code) continue;

    const packageType = String(item.package_type || "OTHER").toUpperCase();
    const normalizedPackageType = (
      ["GROUP", "PT", "SCOLIOSIS", "REFORMER", "MANUAL", "OTHER"].includes(packageType)
        ? packageType
        : "OTHER"
    ) as LessonCatalogPackageType;

    map.set(code, {
      code,
      title: String(item.title || code),
      description: String(item.desc || item.description || ""),
      active: item.active === undefined ? true : Boolean(item.active),
      starting_price: asNumericString(item.starting_price, "0.00"),
      trainer_commission_rate: asNumericString(item.trainer_commission_rate, "25.00"),
      capacity_label: String(item.capacity_label || "1 kişi"),
      package_type: normalizedPackageType,
      category_group: String(item.category_group || "").trim() || null,
      lesson_mode: String(item.lesson_mode || "").trim() || null,
      sub_lessons: Array.isArray(item.sub_lessons)
        ? item.sub_lessons.map((subLesson) => String(subLesson || "").trim()).filter(Boolean)
        : [],
      session_duration_minutes:
        item.session_duration_minutes === undefined || item.session_duration_minutes === null
          ? null
          : Number(item.session_duration_minutes),
      break_duration_minutes:
        item.break_duration_minutes === undefined || item.break_duration_minutes === null
          ? null
          : Number(item.break_duration_minutes),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "tr"));
}

function lessonTypeIcon(packageType: LessonCatalogPackageType) {
  if (packageType === "GROUP") return "fa-solid fa-users";
  if (packageType === "PT") return "fa-solid fa-dumbbell";
  if (packageType === "REFORMER") return "fa-solid fa-wave-square";
  if (packageType === "MANUAL") return "fa-solid fa-hand-holding-medical";
  if (packageType === "SCOLIOSIS") return "fa-solid fa-bone";
  return "fa-solid fa-book";
}

export default function AdminPackageTrainersPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [busy, setBusy] = useState(false);

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [lessonCatalog, setLessonCatalog] = useState<LessonCatalogItem[]>([]);

  const [filterActive, setFilterActive] = useState<"active" | "all" | "inactive">("active");
  const [assignmentFilterPackageId, setAssignmentFilterPackageId] = useState<string>("");
  const [expandedCatalogCodes, setExpandedCatalogCodes] = useState<string[]>([]);
  const [showCatalogAdvancedFields, setShowCatalogAdvancedFields] = useState(false);
  const [selectedLivePackageId, setSelectedLivePackageId] = useState<string>("");

  const [form, setForm] = useState({
    package_id: "",
    trainer_id: "",
  });

  const [packageForm, setPackageForm] = useState<PackageCreateForm>({
    service_key: "",
    title: "",
    total_credits: "",
    duration_days: "30",
    display_price: "",
    is_visible: true,
    is_public: false,
  });

  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageEditForm, setPackageEditForm] = useState<PackageEditForm>({
    title: "",
    total_credits: "",
    duration_days: "30",
    display_price: "",
    is_visible: true,
    is_public: false,
  });
  const [packagePendingDelete, setPackagePendingDelete] = useState<PackageRow | null>(null);

  const activeCatalog = lessonCatalog.filter((item) => item.active);
  const activePackages = packages.filter((pkg) => pkg.is_active);

  const packageMap = useMemo(() => {
    const map = new Map<string, PackageRow>();
    for (const pkg of packages) map.set(pkg.id, pkg);
    return map;
  }, [packages]);
  const assignmentCountByPackage = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of assignments) {
      if (!row.is_active) continue;
      map.set(row.package_id, (map.get(row.package_id) || 0) + 1);
    }
    return map;
  }, [assignments]);
  const selectedAssignmentPackage = useMemo(
    () => packages.find((pkg) => pkg.id === form.package_id) || null,
    [form.package_id, packages]
  );
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === form.trainer_id) || null,
    [form.trainer_id, trainers]
  );
  const recentAssignments = useMemo(
    () =>
      [...assignments]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [assignments]
  );
  const visiblePackages = useMemo(
    () => packages.filter((pkg) => !assignmentFilterPackageId || pkg.id === assignmentFilterPackageId),
    [assignmentFilterPackageId, packages]
  );
  const selectedLivePackage = useMemo(
    () => visiblePackages.find((pkg) => pkg.id === selectedLivePackageId) || visiblePackages[0] || null,
    [selectedLivePackageId, visiblePackages]
  );

  const selectedService = activeCatalog.find((item) => item.code === packageForm.service_key) || null;
  const packageFormErrors = useMemo(
    () => ({
      service_key: packageForm.service_key ? "" : "Paket oluşturmak için aktif bir ders seçin.",
      total_credits:
        !packageForm.total_credits || Number(packageForm.total_credits) <= 0
          ? "Ders hakkı 1 veya daha büyük olmalıdır."
          : "",
      duration_days:
        !packageForm.duration_days || Number(packageForm.duration_days) <= 0
          ? "Süre en az 1 gün olmalıdır."
          : "",
      display_price:
        packageForm.display_price && Number(packageForm.display_price) < 0 ? "Fiyat negatif olamaz." : "",
      title: packageForm.title.trim().length < 3 ? "Paket adı en az 3 karakter olmalıdır." : "",
    }),
    [packageForm.display_price, packageForm.duration_days, packageForm.service_key, packageForm.title, packageForm.total_credits]
  );
  const packageFormHasError = Object.values(packageFormErrors).some(Boolean);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([loadCatalog(), loadPackages(), loadTrainers(), loadAssignments()]).catch(() =>
      toast.error("Paket-eğitmen atama verileri yüklenemedi")
    );
  }, [status, filterActive]);

  useEffect(() => {
    if (visiblePackages.length === 0) {
      setSelectedLivePackageId("");
      return;
    }
    if (!visiblePackages.some((pkg) => pkg.id === selectedLivePackageId)) {
      setSelectedLivePackageId(visiblePackages[0].id);
    }
  }, [selectedLivePackageId, visiblePackages]);

  async function loadCatalog() {
    const payload = await httpRequest<SettingsPayload>("/admin/settings");
    const catalog = normalizeCatalog(payload?.data?.profile?.services || []);
    setLessonCatalog(catalog);
    if (!packageForm.service_key && catalog.length > 0) {
      const firstActive = catalog.find((item) => item.active);
      if (firstActive) {
        setPackageForm((prev) => ({
          ...prev,
          service_key: firstActive.code,
          title: `${firstActive.title} Paketi`,
          display_price: firstActive.starting_price,
        }));
      }
    }
  }

  async function loadPackages() {
    const payload = await httpRequest<{ data: PackageRow[] }>("/admin/packages");
    setPackages(payload.data || []);
  }

  async function loadTrainers() {
    const payload = await httpRequest<{ data: TrainerRow[] }>("/admin/trainers");
    setTrainers((payload.data || []).filter((row) => row.is_active));
  }

  async function loadAssignments() {
    const isActiveParam =
      filterActive === "all" ? "" : `?is_active=${filterActive === "active" ? "true" : "false"}`;
    const payload = await httpRequest<{ data: AssignmentRow[] }>(`/admin/package-trainers${isActiveParam}`);
    setAssignments(payload.data || []);
  }

  async function saveCatalog() {
    if (lessonCatalog.length === 0) {
      toast.error("Ders kataloğu boş olamaz");
      return;
    }
    if (!lessonCatalog.some((item) => item.active)) {
      toast.error("En az bir ders kataloğu öğesi aktif olmalıdır");
      return;
    }

    try {
      setBusy(true);
      await httpRequest("/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            services: lessonCatalog.map((item) => ({
              type: item.code,
              title: item.title,
              desc: item.description,
              starting_price: item.starting_price,
              active: item.active,
              trainer_commission_rate: item.trainer_commission_rate,
              capacity_label: item.capacity_label,
              package_type: item.package_type,
              category_group: item.category_group || undefined,
              lesson_mode: item.lesson_mode || undefined,
              sub_lessons: item.sub_lessons || [],
              session_duration_minutes: item.session_duration_minutes ?? undefined,
              break_duration_minutes: item.break_duration_minutes ?? undefined,
            })),
          },
        }),
      });
      toast.success("Ders kataloğu güncellendi");
      await Promise.all([loadCatalog(), loadPackages()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ders kataloğu kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  function addCustomCatalogRow() {
    const code = `CUSTOM_${Date.now()}`;
    setLessonCatalog((prev) => [
      ...prev,
      {
        code,
        title: "Yeni Ders Tipi",
        description: "Kliniğe özel ders açıklaması",
        active: true,
        starting_price: "0.00",
        trainer_commission_rate: "25.00",
        capacity_label: "1 kişi",
        package_type: "OTHER",
        category_group: null,
        lesson_mode: "PRIVATE",
        sub_lessons: [],
        session_duration_minutes: 45,
        break_duration_minutes: 0,
      },
    ]);
  }

  function updateCatalogRow(code: string, patch: Partial<LessonCatalogItem>) {
    setLessonCatalog((prev) => prev.map((item) => (item.code === code ? { ...item, ...patch } : item)));
  }

  function applyCatalogPreset(code: string, presetKey: string) {
    const preset = CATALOG_PRESET_OPTIONS.find((item) => item.key === presetKey);
    if (!preset) return;
    updateCatalogRow(code, preset.patch);
  }

  function removeCatalogRow(code: string) {
    setLessonCatalog((prev) => prev.filter((item) => item.code !== code));
    setExpandedCatalogCodes((prev) => prev.filter((item) => item !== code));
  }

  function toggleCatalogAccordion(code: string) {
    setExpandedCatalogCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  }

  async function createPackage() {
    const serviceKey = packageForm.service_key.trim();
    if (!serviceKey) {
      toast.error("Önce ders kataloğundan bir ders seçmelisin");
      return;
    }
    if (!packageForm.total_credits || Number(packageForm.total_credits) <= 0) {
      toast.error("Ders hakkı 0'dan büyük olmalıdır");
      return;
    }
    if (!packageForm.duration_days || Number(packageForm.duration_days) <= 0) {
      toast.error("Süre 0'dan büyük olmalıdır");
      return;
    }

    try {
      setBusy(true);
      await httpRequest("/admin/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service_key: serviceKey,
          title: packageForm.title.trim() || `${selectedService?.title || "Ders"} Paketi`,
          total_credits: Number(packageForm.total_credits),
          duration_days: Number(packageForm.duration_days),
          display_price: packageForm.display_price || selectedService?.starting_price || "0",
          is_visible: packageForm.is_visible,
          is_public: packageForm.is_public,
          is_active: true,
        }),
      });
      toast.success("Paket başarıyla oluşturuldu");
      await Promise.all([loadPackages(), loadAssignments()]);
      setPackageForm((prev) => ({
        ...prev,
        title: `${selectedService?.title || "Ders"} Paketi`,
        total_credits: "",
        duration_days: "30",
        display_price: selectedService?.starting_price || "",
        is_visible: true,
        is_public: false,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paket oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment() {
    if (!form.package_id || !form.trainer_id) {
      toast.error("Paket ve eğitmen seçmeniz gerekiyor");
      return;
    }

    try {
      setBusy(true);
      await httpRequest("/admin/package-trainers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success("Paket-eğitmen ataması yapıldı");
      await loadAssignments();
      setForm({ package_id: "", trainer_id: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Atama yapılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/package-trainers/${assignmentId}`, { method: "DELETE" });
      toast.success("Atama kaldırıldı");
      await loadAssignments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Atama kaldırılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function togglePackageStatus(pkg: PackageRow) {
    try {
      setBusy(true);
      await httpRequest(`/admin/packages/${pkg.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: !pkg.is_active }),
      });
      toast.success(pkg.is_active ? "Paket donduruldu alındı" : "Paket aktife alındı");
      await loadPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paket durumu güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  function startEditPackage(pkg: PackageRow) {
    setEditingPackageId(pkg.id);
    setPackageEditForm({
      title: pkg.title,
      total_credits: String(pkg.total_credits),
      duration_days: String(pkg.duration_days),
      display_price: pkg.display_price || "",
      is_visible: pkg.is_visible ?? true,
      is_public: pkg.is_public ?? false,
    });
  }

  async function savePackageEdit(packageId: string) {
    if (!packageEditForm.title.trim()) {
      toast.error("Paket adı zorunludur");
      return;
    }
    if (!packageEditForm.total_credits || Number(packageEditForm.total_credits) <= 0) {
      toast.error("Ders hakkı 0'dan büyük olmalıdır");
      return;
    }
    if (!packageEditForm.duration_days || Number(packageEditForm.duration_days) <= 0) {
      toast.error("Süre 0'dan büyük olmalıdır");
      return;
    }

    try {
      setBusy(true);
      await httpRequest(`/admin/packages/${packageId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: packageEditForm.title.trim(),
          total_credits: Number(packageEditForm.total_credits),
          duration_days: Number(packageEditForm.duration_days),
          display_price: packageEditForm.display_price || "0",
          is_visible: packageEditForm.is_visible,
          is_public: packageEditForm.is_public,
        }),
      });
      toast.success("Paket güncellendi");
      setEditingPackageId(null);
      await loadPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paket güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function deletePackage(packageId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/packages/${packageId}`, { method: "DELETE" });
      toast.success("Paket silindi");
      setPackagePendingDelete(null);
      setEditingPackageId(null);
      await Promise.all([loadPackages(), loadAssignments()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paket silinemedi");
    } finally {
      setBusy(false);
    }
  }

  const filteredAssignments = assignments.filter((row) => {
    if (!assignmentFilterPackageId) return true;
    return row.package_id === assignmentFilterPackageId;
  });
  const selectedLiveAssignments = useMemo(
    () =>
      selectedLivePackage
        ? filteredAssignments.filter((row) => row.package_id === selectedLivePackage.id)
        : [],
    [filteredAssignments, selectedLivePackage]
  );

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }

  if (status === "unauthorized") return null;

  return (
    <AppShell>
      <PageHeader
        title="Paket Akışı Yönetimi"
        description="Önce satılacak ders şablonunu tanımla, sonra satış paketini üret, en son paketi kullanabilecek eğitmeni seç."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Aktif Ders Kataloğu" value={activeCatalog.length} tone="sky" icon={<i className="fa-solid fa-book-open" aria-hidden="true" />} />
        <MetricCard label="Aktif Paket" value={activePackages.length} tone="emerald" icon={<i className="fa-solid fa-box-open" aria-hidden="true" />} />
        <MetricCard label="Toplam Atama" value={assignments.length} tone="slate" icon={<i className="fa-solid fa-link" aria-hidden="true" />} />
        <MetricCard label="Filtreli Atama" value={filteredAssignments.length} tone="amber" icon={<i className="fa-solid fa-filter-circle-dollar" aria-hidden="true" />} />
      </section>

      <Card className="surface-card">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="section-band">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Akış Mantığı</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                <p className="text-sm font-semibold text-slate-900">1. Dersi Tanımla</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Önce ders adı, tipi, kapasitesi ve fiyatı belirlenir.</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                <p className="text-sm font-semibold text-slate-900">2. Paketi Oluştur</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Paket fiyatı ve kategori bilgisi ders tanımından otomatik gelir.</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-[var(--ui-shadow-soft)]">
                <p className="text-sm font-semibold text-slate-900">3. Eğitmene Aç</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Paketi hangi eğitmenlerin kullanabileceği burada belirlenir.</p>
              </div>
            </div>
          </div>
          <div className="section-band">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Canlı Özet</p>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-book-open" className="text-sky-600" />
                <span>Aktif ders: {activeCatalog.length}</span>
              </div>
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-box-open" className="text-sky-600" />
                <span>Üretilen aktif paket: {activePackages.length}</span>
              </div>
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-link" className="text-sky-600" />
                <span>Aktif atama: {assignments.filter((row) => row.is_active).length}</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              `Ayarlar` ekranı sadece özet gösterir. Gerçek ders, paket ve yetki yönetimi bu ekrandan yapılır.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.35fr,0.9fr]">
        <div className="grid gap-4">
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>1. Ders Şablonu</CardTitle>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              action="view"
              variant="outline"
              onClick={() => setShowCatalogAdvancedFields((prev) => !prev)}
            >
              {showCatalogAdvancedFields ? "Gelişmişi Gizle" : "Gelişmiş Alanlar"}
            </ActionButton>
            <ActionButton action="create" variant="outline" onClick={addCustomCatalogRow} disabled={busy}>
              Yeni Şablon Ekle
            </ActionButton>
            <ActionButton action="save" onClick={saveCatalog} disabled={busy}>
              Dersleri Kaydet
            </ActionButton>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            İlk görünüm sadece gerekli alanları gösterir: ders adı, tipi, kapasite ve fiyat. Açıklama ile eğitmen prim oranı gelişmiş alandadır.
          </p>
          <p className="text-xs text-muted-foreground">
            Not: <strong>₺</strong> seans ücretidir. <strong>%</strong> eğitmen prim oranı yalnızca gelişmiş alanda düzenlenir.
          </p>
          {lessonCatalog.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-book-open" aria-hidden="true" />}
              title="Henüz ders tanımı yok"
              description="İlk dersi eklediğinizde paket üretim akışı buradan başlayacak."
            />
          ) : (
            lessonCatalog.map((service) => (
              <article key={service.code} className="list-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => toggleCatalogAccordion(service.code)}
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        service.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <AppIcon icon={lessonTypeIcon(service.package_type)} className="h-4 w-4 text-current" />
                    </span>
                    <div className="min-w-0">
                      <strong>{service.title}</strong>
                      <p className="text-xs text-muted-foreground">
                        {service.package_type} • {service.capacity_label} • {service.starting_price} TL
                      </p>
                    </div>
                    {expandedCatalogCodes.includes(service.code) ? (
                      <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500" />
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{service.package_type}</Badge>
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={service.active}
                        onChange={(e) => updateCatalogRow(service.code, { active: e.target.checked })}
                      />
                      Aktif
                    </label>
                    {service.code.startsWith("CUSTOM_") ? (
                      <ActionButton action="delete" size="sm" onClick={() => removeCatalogRow(service.code)}>
                        Sil
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                {expandedCatalogCodes.includes(service.code) ? (
                  <>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <Select defaultValue="" onChange={(e) => applyCatalogPreset(service.code, e.target.value)}>
                        <option value="">Hazır ders tipi seç</option>
                        {CATALOG_PRESET_OPTIONS.map((preset) => (
                          <option key={preset.key} value={preset.key}>
                            {preset.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        value={service.title}
                        placeholder="Üyenin göreceği ders adı"
                        onChange={(e) => updateCatalogRow(service.code, { title: e.target.value })}
                      />
                      <Select
                        value={service.package_type}
                        onChange={(e) =>
                          updateCatalogRow(service.code, {
                            package_type: e.target.value as LessonCatalogPackageType,
                          })
                        }
                      >
                        {PACKAGE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Input
                        inputMode="decimal"
                        value={service.starting_price}
                        placeholder="Seans fiyatı (₺)"
                        onChange={(e) => updateCatalogRow(service.code, { starting_price: sanitizeDecimalInput(e.target.value) })}
                      />
                      <Input
                        value={service.capacity_label}
                        placeholder="Kaç kişilik verilir?"
                        onChange={(e) => updateCatalogRow(service.code, { capacity_label: e.target.value })}
                      />
                    </div>

                    {showCatalogAdvancedFields ? (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <Input
                          value={service.description}
                          placeholder="Kısa açıklama (opsiyonel)"
                          onChange={(e) => updateCatalogRow(service.code, { description: e.target.value })}
                        />
                        <Input
                          value={service.trainer_commission_rate}
                          inputMode="decimal"
                          placeholder="Eğitmen prim oranı (%)"
                          onChange={(e) =>
                            updateCatalogRow(service.code, { trainer_commission_rate: sanitizeDecimalInput(e.target.value) })
                          }
                        />
                        <Input
                          value={service.category_group || ""}
                          placeholder="Kategori grubu (örn. Pilates)"
                          onChange={(e) => updateCatalogRow(service.code, { category_group: e.target.value })}
                        />
                        <Select
                          value={service.lesson_mode || ""}
                          onChange={(e) => updateCatalogRow(service.code, { lesson_mode: e.target.value || null })}
                        >
                          <option value="">Akış otomatik</option>
                          <option value="PRIVATE">Özel</option>
                          <option value="DUO">Duo</option>
                          <option value="GROUP">Grup</option>
                        </Select>
                        <Input
                          value={(service.sub_lessons || []).join(", ")}
                          placeholder="Alt dersler (virgülle ayır)"
                          onChange={(e) =>
                            updateCatalogRow(service.code, {
                              sub_lessons: e.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input
                            value={service.session_duration_minutes ? String(service.session_duration_minutes) : ""}
                            inputMode="numeric"
                            placeholder="Ders süresi (dk)"
                            onChange={(e) =>
                              updateCatalogRow(service.code, {
                                session_duration_minutes: Number(sanitizeIntegerInput(e.target.value)) || null,
                              })
                            }
                          />
                          <Input
                            value={service.break_duration_minutes === null || service.break_duration_minutes === undefined ? "" : String(service.break_duration_minutes)}
                            inputMode="numeric"
                            placeholder="Ara (dk)"
                            onChange={(e) =>
                              updateCatalogRow(service.code, {
                                break_duration_minutes: Number(sanitizeIntegerInput(e.target.value)) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>2. Satış Paketi Oluştur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              className="md:col-span-2"
              label="Kaynak Ders"
              hint="Paket, seçtiğiniz ders tanımının fiyat, kapasite ve prim bilgisini otomatik alır."
              error={packageFormErrors.service_key}
              required
            >
              <Select
                value={packageForm.service_key}
                onChange={(e) => {
                  const serviceKey = e.target.value;
                  const service = activeCatalog.find((item) => item.code === serviceKey);
                  setPackageForm((prev) => ({
                    ...prev,
                    service_key: serviceKey,
                    title: service ? `${service.title} Paketi` : prev.title,
                    display_price: service?.starting_price || prev.display_price,
                  }));
                }}
              >
                  <option value="">Aktif ders seçin</option>
                  {activeCatalog.map((service) => (
                    <option key={service.code} value={service.code}>
                      {service.title}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField
              className="md:col-span-2"
              label="Paket Adı"
              hint="Üyenin göreceği satış adını yazın"
              error={packageFormErrors.title}
              required
            >
              <Input
                value={packageForm.title}
                placeholder="Paket adını girin"
                onChange={(e) => setPackageForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <FormField label="Paket Fiyatı" hint="Boş bırakırsanız ders fiyatı kullanılır." error={packageFormErrors.display_price}>
              <div className="grid gap-2">
                <Input
                  inputMode="decimal"
                  value={packageForm.display_price}
                  placeholder={selectedService?.starting_price || "0"}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, display_price: sanitizeDecimalInput(e.target.value) }))}
                />
                <div className="flex flex-wrap gap-2">
                  {PRICE_PRESETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        packageForm.display_price === value
                          ? "border-sky-500 bg-sky-600 text-white"
                          : "border-sky-200 bg-white text-slate-700"
                      }`}
                      onClick={() => setPackageForm((prev) => ({ ...prev, display_price: value }))}
                    >
                      {value} TL
                    </button>
                  ))}
                  {selectedService ? (
                    <button
                      type="button"
                      className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition"
                      onClick={() => setPackageForm((prev) => ({ ...prev, display_price: selectedService.starting_price }))}
                    >
                      Ders fiyatını kullan
                    </button>
                  ) : null}
                </div>
              </div>
            </FormField>
            <div className="rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/80 p-3 text-sm">
              <p className="font-medium text-slate-800">Kaynak kapasite</p>
              <p className="mt-1 text-muted-foreground">{selectedService ? selectedService.capacity_label : "-"}</p>
            </div>
            <div className="rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/80 p-3 text-sm">
              <p className="font-medium text-slate-800">Eğitmen prim oranı</p>
              <p className="mt-1 text-muted-foreground">{selectedService ? `%${selectedService.trainer_commission_rate}` : "-"}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[var(--ui-radius-md)] border border-sky-200/70 bg-sky-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Hızlı Ders Hakkı</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CREDIT_PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      packageForm.total_credits === value
                        ? "border-sky-500 bg-sky-600 text-white"
                        : "border-sky-200 bg-white text-slate-700"
                    }`}
                    onClick={() => setPackageForm((prev) => ({ ...prev, total_credits: value }))}
                  >
                    {value} ders
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[var(--ui-radius-md)] border border-emerald-200/70 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Hızlı Süre</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DURATION_PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      packageForm.duration_days === value
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-emerald-200 bg-white text-slate-700"
                    }`}
                    onClick={() => setPackageForm((prev) => ({ ...prev, duration_days: value }))}
                  >
                    {value} gün
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              className="package-create-field"
              label="Ders Hakkı"
              hint="Paket toplam seans adedi."
              error={packageFormErrors.total_credits}
              required
            >
              <Input
                inputMode="numeric"
                value={packageForm.total_credits}
                placeholder="Ders hakkı (örn. 8)"
                onChange={(e) => setPackageForm((prev) => ({ ...prev, total_credits: sanitizeIntegerInput(e.target.value) }))}
              />
            </FormField>
            <FormField
              className="package-create-field"
              label="Süre (Gün)"
              hint="Paketin kullanılabileceği gün sayısı."
              error={packageFormErrors.duration_days}
              required
            >
              <Input
                inputMode="numeric"
                value={packageForm.duration_days}
                placeholder="Süre (gün)"
                onChange={(e) => setPackageForm((prev) => ({ ...prev, duration_days: sanitizeIntegerInput(e.target.value) }))}
              />
            </FormField>
            <div className="rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/80 p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={packageForm.is_visible}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, is_visible: e.target.checked }))}
                />
                Üye panelinde görünür
              </label>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Paket, danışan tarafında gösterilecek satış seçeneklerine dahil edilir.
              </p>
            </div>
            <div className="rounded-[var(--ui-radius-md)] border border-sky-200/70 bg-sky-50/80 p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={packageForm.is_public}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                />
                Landing&apos;de yayınla
              </label>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Public salon sayfası tekrar açıldığında bu paket landing satış listesine dahil edilir. Şu an web bakım modunda olduğu için işaret sadece yayına hazırlık kaydı tutar.
              </p>
            </div>
          </div>

          <div>
            <ActionButton action="create" onClick={createPackage} disabled={busy || packageFormHasError}>
              Paketi Oluştur
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>3. Eğitmene Aç</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
          <Select
            value={form.package_id}
            onChange={(e) => setForm((prev) => ({ ...prev, package_id: e.target.value }))}
          >
            <option value="">Paket seçin</option>
            {activePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.title} - {pkg.pricing_label || "Belirtilmedi"}
              </option>
            ))}
          </Select>
          <Select
            value={form.trainer_id}
            onChange={(e) => setForm((prev) => ({ ...prev, trainer_id: e.target.value }))}
          >
            <option value="">Eğitmen seçin</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {`${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email}
              </option>
            ))}
          </Select>
          <ActionButton action="assign" onClick={createAssignment} disabled={busy}>
            Yetkiyi Kaydet
          </ActionButton>
        </CardContent>
      </Card>
        </div>

        <Card className="surface-card xl:sticky xl:top-24 xl:self-start">
          <CardHeader>
            <CardTitle>Canlı Özet</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="section-band">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Seçili Ders</p>
              {selectedService ? (
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="detail-pill"><AppIcon icon="fa-solid fa-book" className="text-sky-600" /><span>{selectedService.title}</span></div>
                  <div className="detail-pill"><AppIcon icon="fa-solid fa-money-bill" className="text-sky-600" /><span>{selectedService.starting_price} TL • %{selectedService.trainer_commission_rate}</span></div>
                  <div className="detail-pill"><AppIcon icon="fa-solid fa-users" className="text-sky-600" /><span>{selectedService.capacity_label}</span></div>
                </div>
              ) : (
                <EmptyState title="Henüz ders seçilmedi" description="Paket üretmeden önce kaynak dersi seçin." />
              )}
            </div>

            <div className="section-band">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Seçili Paket ve Eğitmen</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="detail-pill">
                  <AppIcon icon="fa-solid fa-box-open" className="text-sky-600" />
                  <span>{selectedAssignmentPackage?.title || packageForm.title || "Paket seçilmedi"}</span>
                </div>
                <div className="detail-pill">
                  <AppIcon icon="fa-solid fa-user-tie" className="text-sky-600" />
                  <span>{selectedTrainer ? `${selectedTrainer.first_name || ""} ${selectedTrainer.last_name || ""}`.trim() || selectedTrainer.email : "Eğitmen seçilmedi"}</span>
                </div>
              </div>
            </div>

            <div className="section-band">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Son Yetkilendirmeler</p>
              <div className="mt-3 grid gap-2">
                {recentAssignments.length === 0 ? (
                  <EmptyState title="Henüz yetkilendirme yok" description="Bir paket seçip eğitmene açtığınızda son işlemler burada görünür." />
                ) : (
                  recentAssignments.map((row) => (
                    <article key={row.id} className="list-row">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{row.package_title || packageMap.get(row.package_id)?.title || "Paket"}</strong>
                        <Badge variant={row.is_active ? "success" : "warning"}>{row.is_active ? "Aktif" : "Donduruldu"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.trainer_full_name || row.trainer_email || row.trainer_id}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>4. Canlı Paketler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="filter-toolbar grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <FormField className="md:self-start" label="Atama Durumu" hint="Aktif veya geçmiş yetkilendirmeleri filtrele.">
              <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value as "active" | "all" | "inactive") }>
                <option value="active">Sadece Aktif Atamalar</option>
                <option value="inactive">Sadece Kaldırılanlar</option>
                <option value="all">Tümü</option>
              </Select>
            </FormField>
            <FormField className="md:self-start" label="Paket Filtresi" hint="Tek paket için atamaları görmek istersen seç.">
              <Select value={assignmentFilterPackageId} onChange={(e) => setAssignmentFilterPackageId(e.target.value)}>
                <option value="">Tüm paketler</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid gap-1.5 md:self-start md:justify-items-end">
              <span className="invisible inline-flex items-center text-sm font-medium" aria-hidden="true">
                Listeyi Yenile
              </span>
              <ActionButton action="refresh" onClick={() => Promise.all([loadAssignments(), loadPackages()])} disabled={busy}>
                Listeyi Yenile
              </ActionButton>
            </div>
          </div>
          {packages.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-box-open" aria-hidden="true" />}
              title="Henüz paket oluşturulmamış"
              description="Önce katalogdan bir ders seçip paket oluşturun."
            />
          ) : (
            <section className="grid gap-4 xl:grid-cols-[360px,1fr]">
              <div className="grid gap-2">
                {visiblePackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className="text-left"
                    onClick={() => setSelectedLivePackageId(pkg.id)}
                  >
                    <article className="list-row" data-state={selectedLivePackage?.id === pkg.id ? "selected" : undefined}>
                      <div className="flex items-center justify-between gap-2">
                        <strong>{pkg.title}</strong>
                        <Badge variant={pkg.is_active ? "success" : "warning"}>{pkg.is_active ? "Aktif" : "Donduruldu"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pkg.pricing_label || "Belirtilmedi"} • {pkg.total_credits} hak • {assignmentCountByPackage.get(pkg.id) || 0} eğitmen
                      </p>
                    </article>
                  </button>
                ))}
              </div>

              {selectedLivePackage ? (
                <article className="surface-card rounded-[var(--ui-radius-lg)] border border-slate-200/80 p-4 xl:sticky xl:top-24">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedLivePackage.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Kaynak ders: {selectedLivePackage.service_name || selectedLivePackage.lesson_category || "Belirtilmedi"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedLivePackage.is_active ? "success" : "warning"}>
                        {selectedLivePackage.is_active ? "Aktif" : "Donduruldu"}
                      </Badge>
                      <Badge variant="outline">{assignmentCountByPackage.get(selectedLivePackage.id) || 0} eğitmen</Badge>
                    </div>
                  </div>

                  <div className="mt-4 detail-grid">
                    <div className="detail-pill"><AppIcon icon="fa-solid fa-layer-group" className="text-sky-600" /><span>Kapasite: {selectedLivePackage.capacity_label || "Belirtilmedi"}</span></div>
                    <div className="detail-pill"><AppIcon icon="fa-solid fa-money-bill" className="text-sky-600" /><span>Fiyat: {selectedLivePackage.pricing_label || "Belirtilmedi"}</span></div>
                    <div className="detail-pill"><AppIcon icon="fa-solid fa-percent" className="text-sky-600" /><span>Prim: {selectedLivePackage.commission_label || "%25.00"}</span></div>
                    <div className="detail-pill"><AppIcon icon="fa-solid fa-calendar-days" className="text-sky-600" /><span>{selectedLivePackage.duration_days} gün • {selectedLivePackage.total_credits} hak</span></div>
                  </div>

                  {editingPackageId === selectedLivePackage.id ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-6">
                      <Input
                        value={packageEditForm.title}
                        onChange={(e) => setPackageEditForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Paket adı"
                      />
                      <Input
                        inputMode="numeric"
                        value={packageEditForm.total_credits}
                        onChange={(e) =>
                          setPackageEditForm((prev) => ({ ...prev, total_credits: sanitizeIntegerInput(e.target.value) }))
                        }
                        placeholder="Ders hakkı"
                      />
                      <Input
                        inputMode="numeric"
                        value={packageEditForm.duration_days}
                        onChange={(e) =>
                          setPackageEditForm((prev) => ({ ...prev, duration_days: sanitizeIntegerInput(e.target.value) }))
                        }
                        placeholder="Süre"
                      />
                      <Input
                        inputMode="decimal"
                        value={packageEditForm.display_price}
                        onChange={(e) =>
                          setPackageEditForm((prev) => ({ ...prev, display_price: sanitizeDecimalInput(e.target.value) }))
                        }
                        placeholder="Fiyat"
                      />
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={packageEditForm.is_visible}
                          onChange={(e) => setPackageEditForm((prev) => ({ ...prev, is_visible: e.target.checked }))}
                        />
                        Üye görünürlüğü
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={packageEditForm.is_public}
                          onChange={(e) => setPackageEditForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                        />
                        Landing görünürlüğü
                      </label>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePackageStatus(selectedLivePackage)}
                      disabled={busy}
                    >
                      <AppIcon icon="fa-solid fa-toggle-on" className="fa-soft" />
                      {selectedLivePackage.is_active ? "Dondur" : "Aktife Al"}
                    </Button>

                    {editingPackageId === selectedLivePackage.id ? (
                      <>
                        <ActionButton action="save" size="sm" onClick={() => savePackageEdit(selectedLivePackage.id)} disabled={busy}>
                          Güncelle
                        </ActionButton>
                        <ActionButton action="cancel" size="sm" onClick={() => setEditingPackageId(null)} disabled={busy}>
                          İptal
                        </ActionButton>
                        <ActionButton action="delete" size="sm" onClick={() => setPackagePendingDelete(selectedLivePackage)} disabled={busy}>
                          Sil
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        <ActionButton action="edit" iconOnly size="sm" tooltip="Düzenle" onClick={() => startEditPackage(selectedLivePackage)} />
                        <ActionButton action="delete" iconOnly size="sm" tooltip="Sil" onClick={() => setPackagePendingDelete(selectedLivePackage)} />
                      </>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-200/80 pt-4">
                    <p className="text-sm font-semibold text-slate-900">Bu paketi kullanabilen eğitmenler</p>
                    <div className="mt-3 grid gap-2">
                      {selectedLiveAssignments.length === 0 ? (
                        <EmptyState
                          title="Bu pakete henüz eğitmen açılmamış"
                          description="Yukarıdaki yetkilendirme alanından bir eğitmen seçerek paketi kullanıma açabilirsiniz."
                        />
                      ) : (
                        selectedLiveAssignments.map((row) => (
                          <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-muted-foreground">
                            <span>{row.trainer_full_name || row.trainer_email || row.trainer_id}</span>
                            {row.is_active ? (
                              <ActionButton action="unassign" iconOnly size="sm" tooltip="Yetkiyi Kaldır" onClick={() => removeAssignment(row.id)} disabled={busy} />
                            ) : (
                              <Badge variant="warning">Donduruldu</Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </article>
              ) : null}
            </section>
          )}
        </CardContent>
      </Card>
      <MobileActionBar>
        <ActionButton action="create" className="w-full" onClick={createPackage} disabled={busy || packageFormHasError}>
          Paketi Oluştur
        </ActionButton>
      </MobileActionBar>
      <ConfirmDialog
        open={Boolean(packagePendingDelete)}
        title="Paketi sil"
        description={`"${packagePendingDelete?.title || "Seçili paket"}" kalıcı olarak silinecek.`}
        note="Bu işlem geri alınamaz. Pakete bağlı akışlarda referans kullanılıyorsa backend hata döndürebilir."
        confirmText="Paketi Sil"
        variant="destructive"
        loading={busy}
        onCancel={() => setPackagePendingDelete(null)}
        onConfirm={() => (packagePendingDelete ? deletePackage(packagePendingDelete.id) : undefined)}
      />
    </AppShell>
  );
}
