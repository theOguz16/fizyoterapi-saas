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

  category_group?: string | null;
  category_label?: string | null;
  lesson_mode?: "GROUP" | "PRIVATE" | "DUO" | null;
  sub_lessons?: string[];
  session_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
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

const CATALOG_LABELS: Record<string, string> = {
  GROUP: "Grup dersi",
  PT: "Özel ders",
  REFORMER: "Reformer",
  MANUAL: "Manuel terapi",
  SCOLIOSIS: "Skolyoz",
  CHILD_YOGA: "Çocuk yogası",
  COCUK_YOGASI: "Çocuk yogası",
  KIDS_YOGA: "Çocuk yogası",
  CHILD: "Çocuk",
  KIDS: "Çocuk",
  PEDIATRIC: "Pediatrik destek",
  PEDIATRIK: "Pediatrik destek",
  YOGA: "Yoga",
  PILATES: "Pilates",
  PILATES_YOGA: "Pilates Yoga",
  CLINICAL_PILATES: "Klinik Pilates",
  INITIAL_ASSESSMENT: "Fizyoterapi değerlendirme",
  ORTHOPEDIC_REHAB: "Ortopedik rehabilitasyon",
  NEUROLOGICAL_REHAB: "Nörolojik rehabilitasyon",
  SPORTS_REHAB: "Sporcu rehabilitasyonu",
  POSTURE_BALANCE: "Postür ve denge",
  LOW_BACK_NECK: "Bel-boyun programı",
  CLINICAL_MASSAGE: "Klinik masaj",
  LYMPH_DRAINAGE: "Lenf drenaj",
  GRASTON: "Graston terapi",
  KINESIO_TAPING: "Kinezyolojik bantlama",
  DEVELOPMENTAL_SUPPORT: "Gelişimsel egzersiz",
  REFORMER_PRIVATE: "Reformer özel ders",
  REFORMER_GROUP: "Reformer grup",
  DUO_TRAINING: "Duo özel ders",
  OTHER: "Diğer",
};

const CATALOG_PARENT_LABELS: Record<string, string> = {
  GROUP: "Grup dersi",
  PT: "Özel ders",
  REFORMER: "Pilates",
  MANUAL: "Terapi",
  SCOLIOSIS: "Klinik destek",
  CHILD_YOGA: "Çocuk",
  COCUK_YOGASI: "Çocuk",
  KIDS_YOGA: "Çocuk",
  CHILD: "Çocuk",
  KIDS: "Çocuk",
  PEDIATRIC: "Çocuk",
  PEDIATRIK: "Çocuk",
  YOGA: "Yoga",
  PILATES: "Pilates",
  PILATES_YOGA: "Pilates",
  CLINICAL_PILATES: "Pilates",
  INITIAL_ASSESSMENT: "Değerlendirme",
  ORTHOPEDIC_REHAB: "Rehabilitasyon",
  NEUROLOGICAL_REHAB: "Rehabilitasyon",
  SPORTS_REHAB: "Rehabilitasyon",
  POSTURE_BALANCE: "Rehabilitasyon",
  LOW_BACK_NECK: "Rehabilitasyon",
  CLINICAL_MASSAGE: "Terapi",
  LYMPH_DRAINAGE: "Terapi",
  GRASTON: "Terapi",
  KINESIO_TAPING: "Terapi",
  DEVELOPMENTAL_SUPPORT: "Çocuk",
  REFORMER_PRIVATE: "Pilates",
  REFORMER_GROUP: "Pilates",
  DUO_TRAINING: "Özel ders",
  OTHER: "Diğer",
};

type DefaultLessonCatalogRow = {
  code: string;
  title: string;
  description: string;
  category_group: string;
  category_label: string;
  starting_price: string;
  trainer_commission_rate: string;
  capacity_label: string;
  package_type: LessonCatalogPackageType;
  lesson_mode: "GROUP" | "PRIVATE" | "DUO";
  session_duration_minutes: number;
  break_duration_minutes: number;
};

const DEFAULT_LESSON_CATALOG: DefaultLessonCatalogRow[] = [
  {
    code: "INITIAL_ASSESSMENT",
    title: "Fizyoterapi değerlendirme",
    description: "İlk görüşme, fonksiyonel analiz ve kişiye özel program planlama.",
    category_group: "Değerlendirme",
    category_label: "Değerlendirme",
    starting_price: "1500.00",
    trainer_commission_rate: "20.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "ORTHOPEDIC_REHAB",
    title: "Ortopedik rehabilitasyon",
    description: "Ameliyat, yaralanma ve kas-iskelet sistemi toparlanma programı.",
    category_group: "Rehabilitasyon",
    category_label: "Rehabilitasyon",
    starting_price: "2200.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "NEUROLOGICAL_REHAB",
    title: "Nörolojik rehabilitasyon",
    description: "İnme, MS, Parkinson ve nörolojik vakalara yönelik fonksiyonel çalışma.",
    category_group: "Rehabilitasyon",
    category_label: "Rehabilitasyon",
    starting_price: "2800.00",
    trainer_commission_rate: "35.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 60,
    break_duration_minutes: 15,
  },
  {
    code: "SPORTS_REHAB",
    title: "Sporcu rehabilitasyonu",
    description: "Sahaya dönüş, performans ve sakatlık sonrası kuvvet programı.",
    category_group: "Rehabilitasyon",
    category_label: "Rehabilitasyon",
    starting_price: "2400.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "POSTURE_BALANCE",
    title: "Postür ve denge",
    description: "Duruş analizi, denge eğitimi ve düzeltici egzersiz seansları.",
    category_group: "Rehabilitasyon",
    category_label: "Rehabilitasyon",
    starting_price: "1800.00",
    trainer_commission_rate: "25.00",
    capacity_label: "1-2 kişi",
    package_type: "OTHER",
    lesson_mode: "DUO",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "LOW_BACK_NECK",
    title: "Bel-boyun programı",
    description: "Bel, boyun ve sırt ağrılarına yönelik klinik egzersiz planı.",
    category_group: "Rehabilitasyon",
    category_label: "Rehabilitasyon",
    starting_price: "2000.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "SCOLIOSIS",
    title: "Skolyoz",
    description: "Skolyoza özel düzeltici egzersiz ve takip programı.",
    category_group: "Klinik destek",
    category_label: "Klinik destek",
    starting_price: "2400.00",
    trainer_commission_rate: "35.00",
    capacity_label: "1 kişi",
    package_type: "SCOLIOSIS",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "MANUAL",
    title: "Manuel terapi",
    description: "Eklem mobilizasyonu ve yumuşak doku odaklı manuel terapi.",
    category_group: "Terapi",
    category_label: "Terapi",
    starting_price: "2500.00",
    trainer_commission_rate: "35.00",
    capacity_label: "1 kişi",
    package_type: "MANUAL",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "CLINICAL_MASSAGE",
    title: "Klinik masaj",
    description: "Ağrı, dolaşım ve gevşeme odaklı terapötik masaj seansı.",
    category_group: "Terapi",
    category_label: "Terapi",
    starting_price: "1700.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "MANUAL",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "LYMPH_DRAINAGE",
    title: "Lenf drenaj",
    description: "Ödem ve dolaşım desteği için manuel lenf drenaj uygulaması.",
    category_group: "Terapi",
    category_label: "Terapi",
    starting_price: "2200.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "MANUAL",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "GRASTON",
    title: "Graston terapi",
    description: "Yumuşak doku mobilizasyonu ve fasya çalışması.",
    category_group: "Terapi",
    category_label: "Terapi",
    starting_price: "2200.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "MANUAL",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "KINESIO_TAPING",
    title: "Kinezyolojik bantlama",
    description: "Ağrı, postür ve sportif destek amaçlı bantlama uygulaması.",
    category_group: "Terapi",
    category_label: "Terapi",
    starting_price: "900.00",
    trainer_commission_rate: "25.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 30,
    break_duration_minutes: 10,
  },
  {
    code: "PEDIATRIC",
    title: "Pediatrik destek",
    description: "Çocuk ve ergenler için fizyoterapi değerlendirme ve egzersiz desteği.",
    category_group: "Çocuk",
    category_label: "Çocuk",
    starting_price: "2300.00",
    trainer_commission_rate: "35.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "DEVELOPMENTAL_SUPPORT",
    title: "Gelişimsel egzersiz",
    description: "Çocuklarda motor gelişim ve koordinasyon odaklı seans.",
    category_group: "Çocuk",
    category_label: "Çocuk",
    starting_price: "1900.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "OTHER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "CHILD_YOGA",
    title: "Çocuk yogası",
    description: "Çocuklara uygun nefes, mobilite ve beden farkındalığı seansı.",
    category_group: "Çocuk",
    category_label: "Çocuk",
    starting_price: "800.00",
    trainer_commission_rate: "25.00",
    capacity_label: "3-8 kişi",
    package_type: "OTHER",
    lesson_mode: "GROUP",
    session_duration_minutes: 45,
    break_duration_minutes: 15,
  },
  {
    code: "CLINICAL_PILATES",
    title: "Klinik Pilates",
    description: "Fizyoterapist eşliğinde klinik egzersiz ve postür çalışması.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "1500.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1-2 kişi",
    package_type: "OTHER",
    lesson_mode: "DUO",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "REFORMER",
    title: "Reformer",
    description: "Reformer ekipmanı ile klinik pilates ve kontrollü kuvvet çalışması.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "1600.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1-2 kişi",
    package_type: "REFORMER",
    lesson_mode: "DUO",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "REFORMER_PRIVATE",
    title: "Reformer özel ders",
    description: "Birebir reformer pilates ve klinik egzersiz seansı.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "2200.00",
    trainer_commission_rate: "35.00",
    capacity_label: "1 kişi",
    package_type: "REFORMER",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "REFORMER_GROUP",
    title: "Reformer grup",
    description: "Küçük grup reformer pilates seansı.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "650.00",
    trainer_commission_rate: "25.00",
    capacity_label: "3-6 kişi",
    package_type: "GROUP",
    lesson_mode: "GROUP",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "PILATES",
    title: "Pilates",
    description: "Mat pilates ve temel beden farkındalığı dersi.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "900.00",
    trainer_commission_rate: "25.00",
    capacity_label: "3-8 kişi",
    package_type: "GROUP",
    lesson_mode: "GROUP",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "PILATES_YOGA",
    title: "Pilates Yoga",
    description: "Pilates ve yoga temelli mobilite, nefes ve core seansı.",
    category_group: "Pilates",
    category_label: "Pilates",
    starting_price: "900.00",
    trainer_commission_rate: "25.00",
    capacity_label: "3-8 kişi",
    package_type: "GROUP",
    lesson_mode: "GROUP",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "YOGA",
    title: "Yoga",
    description: "Mobilite, nefes ve gevşeme odaklı yoga seansı.",
    category_group: "Yoga",
    category_label: "Yoga",
    starting_price: "800.00",
    trainer_commission_rate: "25.00",
    capacity_label: "3-10 kişi",
    package_type: "GROUP",
    lesson_mode: "GROUP",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "PT",
    title: "Özel ders",
    description: "Birebir kuvvet, mobilite ve fonksiyonel egzersiz seansı.",
    category_group: "Özel ders",
    category_label: "Özel ders",
    starting_price: "2000.00",
    trainer_commission_rate: "30.00",
    capacity_label: "1 kişi",
    package_type: "PT",
    lesson_mode: "PRIVATE",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "DUO_TRAINING",
    title: "Duo özel ders",
    description: "İki kişilik kişiselleştirilmiş klinik egzersiz seansı.",
    category_group: "Özel ders",
    category_label: "Özel ders",
    starting_price: "1300.00",
    trainer_commission_rate: "30.00",
    capacity_label: "2 kişi",
    package_type: "PT",
    lesson_mode: "DUO",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
  {
    code: "GROUP",
    title: "Grup dersi",
    description: "Klinik egzersiz ve genel kondisyon odaklı grup dersi.",
    category_group: "Grup dersi",
    category_label: "Grup dersi",
    starting_price: "650.00",
    trainer_commission_rate: "25.00",
    capacity_label: "4-10 kişi",
    package_type: "GROUP",
    lesson_mode: "GROUP",
    session_duration_minutes: 50,
    break_duration_minutes: 10,
  },
];

function safeUpper(input: unknown) {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

export function catalogLabelForCode(input: unknown) {
  const code = normalizeCode(input);
  return CATALOG_LABELS[code] || null;
}

export function catalogParentLabelForCode(input: unknown, fallbackType?: unknown) {
  const code = normalizeCode(input);
  const fallbackCode = normalizeCode(fallbackType);
  return CATALOG_PARENT_LABELS[code] || CATALOG_PARENT_LABELS[fallbackCode] || null;
}

function normalizeCode(input: unknown) {
  return String(input ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
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

function normalizeLessonMode(value: unknown, fallback?: unknown): "GROUP" | "PRIVATE" | "DUO" {
  const normalized = safeUpper(value || fallback);

  if (normalized === "GROUP" || normalized === "GRUP") return "GROUP";
  if (normalized === "DUO" || normalized === "TWO_PERSON") return "DUO";
  if (normalized === "PRIVATE" || normalized === "SINGLE" || normalized === "OZEL" || normalized === "ÖZEL") {
    return "PRIVATE";
  }

  return "PRIVATE";
}

function asBoundedMinutes(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(180, parsed));
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

function hasExplicitValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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
  const map = new Map<string, LessonCatalogItem>();
  const rows = [
    ...DEFAULT_LESSON_CATALOG,
    ...(Array.isArray(raw) ? raw : []),
  ];

  for (const entry of rows) {
    const row = asObject(entry);
    const code = normalizeCode(row.type ?? row.code ?? row.sub_category ?? row.subcategory ?? row.sub_category_label ?? row.title ?? row.name);
    if (!code) continue;

    const knownSubCategoryLabel = catalogLabelForCode(code);
    const titleRaw = String(row.title ?? row.sub_category ?? row.subcategory ?? row.sub_category_label ?? row.name ?? knownSubCategoryLabel ?? "").trim();
    const descriptionRaw = String(row.desc ?? row.description ?? "").trim();
    const capacityLabelRaw = String(row.capacity_label ?? "").trim() || "1 kişi";
    const fallbackType = mapToPackageType(code);
    const packageTypeRaw = mapToLessonCatalogPackageType(row.package_type || fallbackType);
    const knownParentLabel = catalogParentLabelForCode(code, packageTypeRaw);
    const categoryGroupRaw = String(row.category_group ?? row.main_category ?? row.parent_category ?? row.category ?? knownParentLabel ?? "").trim();
    const categoryLabelRaw = String(row.category_label ?? row.main_category_label ?? row.parent_category_label ?? knownParentLabel ?? "").trim();

    map.set(code, {
      code,
      title: titleRaw || knownSubCategoryLabel || code,
      description: descriptionRaw,
      active: row.active === undefined ? true : Boolean(row.active),
      starting_price: asNonNegativeString(row.starting_price, "0.00"),
      trainer_commission_rate: asRateString(row.trainer_commission_rate, "25.00"),
      capacity_label: capacityLabelRaw,
      package_type: packageTypeRaw,

      category_group: categoryGroupRaw || null,
      category_label: categoryLabelRaw || categoryGroupRaw || null,
      lesson_mode: normalizeLessonMode(row.lesson_mode, parseCapacityFromLabel(capacityLabelRaw) > 2 ? "GROUP" : parseCapacityFromLabel(capacityLabelRaw) === 2 ? "DUO" : "PRIVATE"),
      sub_lessons: asStringArray(row.sub_lessons),
      session_duration_minutes: asBoundedMinutes(row.session_duration_minutes, 45),
      break_duration_minutes: asBoundedMinutes(row.break_duration_minutes, 0),
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
  const hasExplicitDisplayPrice = hasExplicitValue(params.explicitDisplayPrice);
  const hasExplicitCapacity = hasExplicitValue(params.explicitCapacity);
  const hasExplicitCommissionRate = hasExplicitValue(params.explicitCommissionRate);

  const packageType = catalogItem
    ? mapToPackageType(catalogItem.package_type)
    : mapToPackageType(params.explicitType);

  const displayPrice = hasExplicitDisplayPrice
    ? asNonNegativeString(params.explicitDisplayPrice, catalogItem?.starting_price || "0.00")
    : catalogItem
      ? catalogItem.starting_price
      : asNonNegativeString(params.explicitDisplayPrice, "0.00");

  const capacity = hasExplicitCapacity
    ? Math.max(0, Math.floor(Number(params.explicitCapacity) || 0))
    : catalogItem
      ? parseCapacityFromLabel(catalogItem.capacity_label)
      : Math.max(0, Math.floor(Number(params.explicitCapacity) || 0));

  const commissionRate = hasExplicitCommissionRate
    ? Number(asRateString(params.explicitCommissionRate, catalogItem?.trainer_commission_rate || String(baseRules.trainer_commission_rate ?? "25.00")))
    : catalogItem
      ? Number(catalogItem.trainer_commission_rate)
      : Number(asRateString(params.explicitCommissionRate, String(baseRules.trainer_commission_rate ?? "25.00")));

  const serviceKey = catalogItem?.code || normalizeCode(params.serviceKey) || normalizeCode(params.lessonCategory) || undefined;
  const lessonCategory = catalogItem?.code || normalizeCode(params.lessonCategory) || normalizeCode(String(baseRules.lesson_category ?? ""));
  const serviceName = catalogItem?.title || String(baseRules.service_name ?? "").trim() || null;
  const capacityLabel = catalogItem?.capacity_label || String(baseRules.capacity_label ?? "").trim() || null;
  const normalizedLessonMode = normalizeLessonMode(
    params.lessonMode,
    catalogItem?.lesson_mode ?? baseRules.lesson_mode ?? (capacity > 2 ? "GROUP" : capacity === 2 ? "DUO" : "PRIVATE")
  );

const sessionDurationMinutes = Math.max(
  30,
  Math.min(
    180,
    Math.floor(
      Number(
        params.sessionDurationMinutes ??
          catalogItem?.session_duration_minutes ??
          baseRules.session_duration_minutes ??
          45
      ) || 45
    )
  )
);

const breakDurationMinutes = Math.max(
  0,
  Math.min(
    60,
    Math.floor(
      Number(
        params.breakDurationMinutes ??
          catalogItem?.break_duration_minutes ??
          baseRules.break_duration_minutes ??
          0
      ) || 0
    )
  )
);

const subLessons = asStringArray(
  params.subLessons ??
    (catalogItem?.sub_lessons && catalogItem.sub_lessons.length > 0 ? catalogItem.sub_lessons : baseRules.sub_lessons)
);

  const rules = {
    ...baseRules,
    ...(serviceKey ? { service_key: serviceKey } : {}),
    ...(lessonCategory ? { lesson_category: lessonCategory } : {}),
    ...(serviceName ? { service_name: serviceName } : {}),
    ...(capacityLabel ? { capacity_label: capacityLabel } : {}),
    ...(catalogItem?.category_group ? { category_group: catalogItem.category_group } : {}),
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
    lesson_mode: String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase(),
    sub_lessons: asStringArray(rules.sub_lessons),
    linked_group_class_ids: asStringArray(rules.linked_group_class_ids),
    linked_group_class_titles: asStringArray(rules.linked_group_class_titles),
    session_duration_minutes: Math.max(30, Math.floor(Number(rules.session_duration_minutes ?? 45) || 45)),
    break_duration_minutes: Math.max(0, Math.floor(Number(rules.break_duration_minutes ?? 0) || 0)),
    allow_member_multi_select:
      typeof rules.allow_member_multi_select === "boolean"
        ? rules.allow_member_multi_select
        : String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase() === "GROUP",
    allow_drop_in_booking:
      typeof rules.allow_drop_in_booking === "boolean"
        ? rules.allow_drop_in_booking
        : String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase() === "GROUP",
  };
}
