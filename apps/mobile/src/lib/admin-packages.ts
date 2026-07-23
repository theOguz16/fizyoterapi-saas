import type { AdminPackage, AdminPackageFormTemplate } from "@fitnes-saas/contracts";
import { packageTypeLabel } from "./labels";

export type LessonVariant = {
  key: string;
  categoryKey: string;
  categoryLabel: string;
  label: string;
  packageType: string;
  isTrial?: boolean;
};

export const LESSON_VARIANTS: LessonVariant[] = [
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

export const LESSON_CATEGORIES = Array.from(
  new Map(LESSON_VARIANTS.map((item) => [item.categoryKey, { key: item.categoryKey, label: item.categoryLabel }])).values()
);
export const DEFAULT_SESSION_DURATION = 45;

export function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(",", ".");
  const [integerPart = "", decimalPart = ""] = normalized.split(".");
  const safeInteger = integerPart.replace(/[^\d]/g, "");
  const safeDecimal = decimalPart.replace(/[^\d]/g, "").slice(0, 2);
  return safeDecimal ? `${safeInteger}.${safeDecimal}` : safeInteger;
}

export function toTestIdSegment(value: string) {
  return normalizePackageText(String(value || ""))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function templateTypeLabel(template?: AdminPackageFormTemplate | null) {
  const type = String(template?.package_type || "").toUpperCase();
  if (template?.package_type_label) return String(template.package_type_label);
  return packageTypeLabel(template?.sub_category_key || template?.service_key || type);
}

export function categoryKeyForTemplate(template: AdminPackageFormTemplate) {
  return String(template.category_group || "").trim() || String(template.package_type || "OTHER").trim() || "OTHER";
}

export function categoryLabelFromKey(key: string, explicitLabel?: string | null) {
  if (explicitLabel && String(explicitLabel).trim()) return String(explicitLabel).trim();
  return String(key || "OTHER").replace(/_/g, " ").toLocaleLowerCase("tr-TR").replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase("tr-TR"));
}

export function lessonModeLabel(mode?: string | null) {
  const normalized = String(mode || "").toUpperCase();
  if (normalized === "GROUP") return "Grup";
  if (normalized === "DUO") return "Duo";
  return "Özel";
}

export function capacityForLessonMode(mode: string, fallback: number) {
  if (mode === "PRIVATE") return 1;
  if (mode === "DUO") return 2;
  return Math.max(3, fallback || 4);
}

export function templateDefaultTitle(template?: AdminPackageFormTemplate | null) {
  if (!template) return "";
  return String(template.default_title || (template.service_name ? `${template.service_name} Paketi` : "")).trim();
}

export function templateDisplayName(template: AdminPackageFormTemplate) {
  return String(template.sub_category_label || template.service_name || template.service_key || "").trim();
}

export function normalizePackageText(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
}

export function templateLooksLikeTrial(template?: AdminPackageFormTemplate | null) {
  if (!template) return false;
  const search = normalizePackageText(`${template.service_key} ${template.service_name} ${template.starting_price}`);
  return Number(template.starting_price || 0) === 0 || search.includes("ucretsiz") || search.includes("deneme");
}

export function findBestTemplateForVariant(variantKey: string, templates: AdminPackageFormTemplate[]) {
  const variant = LESSON_VARIANTS.find((item) => item.key === variantKey);
  if (!variant || templates.length === 0) return templates[0] || null;
  const byType = templates.filter((item) => String(item.package_type || "").toUpperCase() === variant.packageType);
  const pool = byType.length > 0 ? byType : templates;
  const label = normalizePackageText(variant.label);
  return pool.find((item) => normalizePackageText(String(item.service_name || "")).includes(label)) ||
    pool.find((item) => label.includes(normalizePackageText(String(item.service_name || "")))) || pool[0] || null;
}

export function deriveWeeklyRuleSummary(weeklyClassHoursRaw: string) {
  const weeklyClassHours = Number(weeklyClassHoursRaw || 0);
  if (!Number.isFinite(weeklyClassHours) || !Number.isInteger(weeklyClassHours) || weeklyClassHours < 1 || weeklyClassHours > 7) {
    return null;
  }
  return { weeklyClassHours, requiredPreferenceSlots: weeklyClassHours * 3, requiredTrainerFreeSlots: weeklyClassHours * 2 };
}

export function buildVariantDefaults(variant: LessonVariant | undefined, template: AdminPackageFormTemplate | null) {
  const isGroup = variant?.packageType === "GROUP";
  return {
    total_credits: isGroup ? "8" : "4",
    weekly_class_hours: isGroup ? "2" : "1",
    duration_days: "30",
    display_price: sanitizeDecimalInput(String(template?.starting_price || (isGroup ? "200" : "0"))),
    trainer_commission_rate: sanitizeDecimalInput(String(template?.trainer_commission_rate || "25")),
    capacity: String(template?.suggested_capacity || (isGroup ? 4 : 1)),
    session_duration_minutes: String(template?.session_duration_minutes || DEFAULT_SESSION_DURATION),
    break_duration_minutes: String(template?.break_duration_minutes || 0),
    lesson_mode: template?.lesson_mode || (isGroup ? "GROUP" : "PRIVATE"),
  };
}

export function filterAdminPackages(packages: AdminPackage[], search: string, status: "ALL" | "ACTIVE" | "PASSIVE") {
  const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
  return packages.filter((pkg) => {
    const searchOk = !normalizedSearch || String(pkg.title || "").toLocaleLowerCase("tr-TR").includes(normalizedSearch) ||
      String(pkg.service_name || "").toLocaleLowerCase("tr-TR").includes(normalizedSearch);
    const statusOk = status === "ALL" || (status === "ACTIVE" ? pkg.is_active : !pkg.is_active);
    return searchOk && statusOk;
  });
}
