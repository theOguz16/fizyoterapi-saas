// Bu helper modulu mobil tarafta admin approvals ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type AdminApprovalRow = {
  type?: string | null;
  status?: string | null;
};

type DashboardKpisLike = {
  pending_applications?: number | null;
  pending_payments?: number | null;
} | null;

export function buildAdminApprovalCounts(rows: AdminApprovalRow[], dashboardKpis?: DashboardKpisLike) {
  return {
    pendingApplications:
      dashboardKpis?.pending_applications ?? rows.filter((row) => row.type === "APPLICATION").length,
    pendingPayments:
      dashboardKpis?.pending_payments ?? rows.filter((row) => row.type === "PAYMENT").length,
    changeRequests: rows.filter((row) => row.type === "CHANGE_REQUEST").length,
  };
}

export function getAdminApprovalStatusMeta(status?: string | null) {
  if (status === "APPROVED") {
    return { iconName: "approvals" as const, tone: "success" as const, label: "Onaylandı" };
  }
  if (status === "REJECTED") {
    return { iconName: "risk" as const, tone: "danger" as const, label: "Reddedildi" };
  }
  return { iconName: "request" as const, tone: "warning" as const, label: "Bekliyor" };
}
