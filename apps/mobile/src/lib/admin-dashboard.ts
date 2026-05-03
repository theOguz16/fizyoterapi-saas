// Bu helper modulu mobil tarafta admin dashboard ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type DashboardDataLike = {
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
