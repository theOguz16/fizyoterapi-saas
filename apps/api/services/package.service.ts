// Bu servis modulu backend tarafinda package.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { Package, PackageType } from "../entities/package.entity";

export type LessonCatalogPackageType =
  | "GROUP"
  | "PT"
  | "SCOLIOSIS"
  | "REFORMER"
  | "MANUAL"
  | "OTHER";

export type LessonCatalogItem = {
  code: string;
  title: string;
  description: string;
  active: boolean;
  starting_price: string;
  trainer_commission_rate: string;
  capacity_label: string;
  package_type: LessonCatalogPackageType;
};

type DerivePackageParams = {
  serviceKey?: string;
  lessonCategory?: string;
  explicitType?: unknown;
  explicitDisplayPrice?: unknown;
  explicitCapacity?: unknown;
  explicitCommissionRate?: unknown;
  existingRules?: unknown;
  lessonMode?: unknown;
  subLessons?: unknown;
  sessionDurationMinutes?: unknown;
  breakDurationMinutes?: unknown;
};

const LESSON_PACKAGE_TYPES: LessonCatalogPackageType[] = [
  "GROUP",
  "PT",
  "SCOLIOSIS",
  "REFORMER",
  "MANUAL",
  "OTHER",
];

function safeUpper(input: unknown) {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

function normalizeCode(input: unknown) {
  return safeUpper(input)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function asNonNegativeString(value: unknown, fallback: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed.toFixed(2);
}

function asRateString(value: unknown, fallback: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(100, Math.max(0, parsed));
  return clamped.toFixed(2);
}

function parseCapacityFromLabel(label: string) {
  const matches = label.match(/\d+/g);
  if (!matches || matches.length === 0) return 1;
  return matches.reduce((max, item) => {
    const parsed = Number(item);
    if (!Number.isFinite(parsed)) return max;
    return parsed > max ? parsed : max;
  }, 0);
}

function mapToPackageType(value: unknown): PackageType {
  const normalized = safeUpper(value);
  if (normalized === "GROUP" || normalized === "GRUP") return PackageType.GROUP;
  if (normalized === "PT") return PackageType.PT;
  if (normalized === "SCOLIOSIS" || normalized === "SKOLYOZ") return PackageType.SCOLIOSIS;
  if (normalized === "REFORMER") return PackageType.REFORMER;
  if (normalized === "MANUAL" || normalized === "MANUEL") return PackageType.MANUAL;
  return PackageType.OTHER;
}

function mapToLessonCatalogPackageType(value: unknown): LessonCatalogPackageType {
  const normalized = safeUpper(value) as LessonCatalogPackageType;
  if (LESSON_PACKAGE_TYPES.includes(normalized)) return normalized;
  return "OTHER";
}

export function normalizeLessonCatalogServices(raw: unknown): LessonCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, LessonCatalogItem>();

  for (const entry of raw) {
    const row = asObject(entry);
    const code = normalizeCode(row.type ?? row.code ?? row.title);
    if (!code) continue;

    const titleRaw = String(row.title ?? "").trim();
    const descriptionRaw = String(row.desc ?? row.description ?? "").trim();
    const capacityLabelRaw = String(row.capacity_label ?? "").trim() || "1 kişi";
    const fallbackType = mapToPackageType(code);
    const packageTypeRaw = mapToLessonCatalogPackageType(row.package_type || fallbackType);

    map.set(code, {
      code,
      title: titleRaw || code,
      description: descriptionRaw,
      active: row.active === undefined ? true : Boolean(row.active),
      starting_price: asNonNegativeString(row.starting_price, "0.00"),
      trainer_commission_rate: asRateString(row.trainer_commission_rate, "25.00"),
      capacity_label: capacityLabelRaw,
      package_type: packageTypeRaw,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "tr"));
}

export function findLessonCatalogItem(
  catalog: LessonCatalogItem[],
  serviceKey?: string,
  lessonCategory?: string
): LessonCatalogItem | null {
  const key = normalizeCode(serviceKey);
  const category = normalizeCode(lessonCategory);

  if (key) {
    const byKey = catalog.find((item) => item.code === key);
    if (byKey) return byKey;
  }
  if (category) {
    const byCategory = catalog.find((item) => item.code === category);
    if (byCategory) return byCategory;
  }
  return null;
}

export function derivePackageFromCatalog(catalog: LessonCatalogItem[], params: DerivePackageParams) {
  const baseRules = asObject(params.existingRules);
  const catalogItem = findLessonCatalogItem(catalog, params.serviceKey, params.lessonCategory);
  const hasExplicitDisplayPrice =
    params.explicitDisplayPrice !== undefined &&
    params.explicitDisplayPrice !== null &&
    String(params.explicitDisplayPrice).trim() !== "";

  const packageType = catalogItem
    ? mapToPackageType(catalogItem.package_type)
    : mapToPackageType(params.explicitType);

  const displayPrice = hasExplicitDisplayPrice
    ? asNonNegativeString(params.explicitDisplayPrice, catalogItem?.starting_price || "0.00")
    : catalogItem
      ? catalogItem.starting_price
      : asNonNegativeString(params.explicitDisplayPrice, "0.00");

  const capacity = catalogItem
    ? parseCapacityFromLabel(catalogItem.capacity_label)
    : Math.max(0, Math.floor(Number(params.explicitCapacity) || 0));

  const commissionRate = catalogItem
    ? Number(catalogItem.trainer_commission_rate)
    : Number(asRateString(params.explicitCommissionRate, String(baseRules.trainer_commission_rate ?? "25.00")));

  const serviceKey = catalogItem?.code || normalizeCode(params.serviceKey) || normalizeCode(params.lessonCategory) || undefined;
  const lessonCategory = catalogItem?.code || normalizeCode(params.lessonCategory) || normalizeCode(String(baseRules.lesson_category ?? ""));
  const serviceName = catalogItem?.title || String(baseRules.service_name ?? "").trim() || null;
  const capacityLabel = catalogItem?.capacity_label || String(baseRules.capacity_label ?? "").trim() || null;
  const normalizedLessonMode = String(params.lessonMode ?? baseRules.lesson_mode ?? (capacity > 2 ? "GROUP" : capacity === 2 ? "DUO" : "SINGLE"))
    .trim()
    .toUpperCase();
  const sessionDurationMinutes = Math.max(
    30,
    Math.min(120, Math.floor(Number(params.sessionDurationMinutes ?? baseRules.session_duration_minutes ?? 45) || 45))
  );
  const breakDurationMinutes = Math.max(
    0,
    Math.min(60, Math.floor(Number(params.breakDurationMinutes ?? baseRules.break_duration_minutes ?? 0) || 0))
  );
  const subLessons = asStringArray(params.subLessons ?? baseRules.sub_lessons);

  const rules = {
    ...baseRules,
    ...(serviceKey ? { service_key: serviceKey } : {}),
    ...(lessonCategory ? { lesson_category: lessonCategory } : {}),
    ...(serviceName ? { service_name: serviceName } : {}),
    ...(capacityLabel ? { capacity_label: capacityLabel } : {}),
    lesson_mode: normalizedLessonMode,
    sub_lessons: subLessons,
    session_duration_minutes: sessionDurationMinutes,
    break_duration_minutes: breakDurationMinutes,
    allow_member_multi_select: normalizedLessonMode === "GROUP",
    allow_drop_in_booking: normalizedLessonMode === "GROUP",
    trainer_commission_rate: commissionRate,
  };

  return {
    catalogItem,
    packageType,
    displayPrice,
    capacity,
    rules,
  };
}

export function enrichPackageRowForDisplay(pkg: Package, catalog: LessonCatalogItem[]) {
  const rules = asObject(pkg.rules);
  const serviceKey = normalizeCode(rules.service_key ?? rules.lesson_category);
  const catalogItem = findLessonCatalogItem(catalog, serviceKey, serviceKey);
  const commissionValue = Number(rules.trainer_commission_rate);
  const commissionRate = Number.isFinite(commissionValue) ? commissionValue : 25;
  const lessonCategory = normalizeCode(rules.lesson_category || catalogItem?.code || "");

  const capacityLabel =
    String(rules.capacity_label ?? "").trim() ||
    catalogItem?.capacity_label ||
    (pkg.capacity > 0 ? `${pkg.capacity} kişi` : "Belirtilmedi");
  const serviceName =
    String(rules.service_name ?? "").trim() ||
    catalogItem?.title ||
    (lessonCategory ? lessonCategory : "Belirtilmedi");
  const summary =
    String(rules.summary ?? "").trim() ||
    catalogItem?.description ||
    null;

  const priceLabel = pkg.display_price ? `${pkg.display_price} TL` : "Belirtilmedi";

  return {
    ...pkg,
    service_key: serviceKey || null,
    service_name: serviceName,
    summary,
    lesson_category: lessonCategory || null,
    capacity_label: capacityLabel,
    trainer_commission_rate: commissionRate,
    pricing_label: priceLabel,
    commission_label: `%${commissionRate.toFixed(2)}`,
    lesson_mode: String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "SINGLE")).toUpperCase(),
    sub_lessons: asStringArray(rules.sub_lessons),
    linked_group_class_ids: asStringArray(rules.linked_group_class_ids),
    linked_group_class_titles: asStringArray(rules.linked_group_class_titles),
    session_duration_minutes: Math.max(30, Math.floor(Number(rules.session_duration_minutes ?? 45) || 45)),
    break_duration_minutes: Math.max(0, Math.floor(Number(rules.break_duration_minutes ?? 0) || 0)),
    allow_member_multi_select:
      typeof rules.allow_member_multi_select === "boolean"
        ? rules.allow_member_multi_select
        : String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "SINGLE")).toUpperCase() === "GROUP",
    allow_drop_in_booking:
      typeof rules.allow_drop_in_booking === "boolean"
        ? rules.allow_drop_in_booking
        : String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "SINGLE")).toUpperCase() === "GROUP",
  };
}
