// Bu helper modulu mobil tarafta admin dashboard ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type DashboardDataLike = {
  quick_setup?: {
    steps?: Partial<Record<QuickSetupStepKey, boolean>> | null;
    completed?: number | null;
    total?: number | null;
    is_complete?: boolean | null;
  } | null;
  kpis?: {
    active_trainers?: number | null;
    active_members?: number | null;
    at_risk_members?: number | null;
    todays_bookings?: number | null;
  } | null;
  revenue?: {
    daily?: number | null;
    weekly?: number | null;
    monthly?: number | null;
  } | null;
  leads?: {
    by_status?: {
      NEW?: number | null;
      CONTACTED?: number | null;
      WON?: number | null;
      LOST?: number | null;
    } | null;
  } | null;
  risk_preview?: unknown[] | null;
} | null;

export type QuickSetupStepKey = "clinic" | "package" | "working_hours" | "clinic_qr" | "dashboard_preview";

export type QuickSetupStep = {
  key: QuickSetupStepKey;
  title: string;
  description: string;
  complete: boolean;
  route: string | null;
  icon: "clinic" | "package" | "clock" | "qr" | "dashboard";
};

const QUICK_SETUP_DEFINITIONS: Omit<QuickSetupStep, "complete">[] = [
  {
    key: "clinic",
    title: "Klinik bilgileri",
    description: "Klinik profilin yayına hazır.",
    route: "/(admin)/salon",
    icon: "clinic",
  },
  {
    key: "package",
    title: "İlk paketini oluştur",
    description: "Danışanların satın alabileceği ilk hizmeti ekle.",
    route: "/(admin)/packages",
    icon: "package",
  },
  {
    key: "working_hours",
    title: "Çalışma saatleri",
    description: "Takvim slotlarının oluşacağı saatleri kontrol et.",
    route: "/(admin)/working-hours",
    icon: "clock",
  },
  {
    key: "clinic_qr",
    title: "QR ve danışan daveti",
    description: "Salon QR'ını aç, kaydet veya paylaş.",
    route: "/(admin)/clinic-qr",
    icon: "qr",
  },
  {
    key: "dashboard_preview",
    title: "Yönetim özeti",
    description: "Operasyon göstergelerin bu ekranda hazır.",
    route: null,
    icon: "dashboard",
  },
];

export function buildQuickSetupChecklist(data?: DashboardDataLike) {
  const rawSteps = data?.quick_setup?.steps || {};
  const steps = QUICK_SETUP_DEFINITIONS.map((step) => ({
    ...step,
    complete: Boolean(rawSteps[step.key]),
  }));
  const completed = steps.filter((step) => step.complete).length;

  return {
    steps,
    completed,
    total: steps.length,
    isComplete: completed === steps.length,
    nextStep: steps.find((step) => !step.complete && step.route) || null,
  };
}

export function buildAdminDashboardMetrics(data?: DashboardDataLike) {
  return {
    activeTrainers: data?.kpis?.active_trainers ?? 0,
    activeMembers: data?.kpis?.active_members ?? 0,
    atRiskMembers: data?.kpis?.at_risk_members ?? 0,
    todaysBookings: data?.kpis?.todays_bookings ?? 0,
    dailyRevenue: Number(data?.revenue?.daily || 0),
    weeklyRevenue: Number(data?.revenue?.weekly || 0),
    monthlyRevenue: Number(data?.revenue?.monthly || 0),
    newLeads: data?.leads?.by_status?.NEW ?? 0,
    contactedLeads: data?.leads?.by_status?.CONTACTED ?? 0,
    wonLeads: data?.leads?.by_status?.WON ?? 0,
    lostLeads: data?.leads?.by_status?.LOST ?? 0,
    riskPreviewCount: Array.isArray(data?.risk_preview) ? data!.risk_preview!.length : 0,
  };
}
