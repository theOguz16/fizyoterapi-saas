import type { AdminDirectoryPerson } from "@fitnes-saas/contracts";

export type AdminDirectoryRole = "MEMBER" | "TRAINER";
export type AdminDirectoryStatusFilter = "ALL" | "ACTIVE" | "PASSIVE" | "RISK";
export type AdminDirectoryRoleFilter = "ALL" | AdminDirectoryRole;
export type AdminDirectoryItem = AdminDirectoryPerson & { role: AdminDirectoryRole };

export function buildAdminDirectory(
  members: AdminDirectoryPerson[],
  trainers: AdminDirectoryPerson[],
): AdminDirectoryItem[] {
  return [
    ...members.map((item) => ({ ...item, role: "MEMBER" as const })),
    ...trainers.map((item) => ({ ...item, role: "TRAINER" as const })),
  ];
}

export function getDirectoryPersonStatus(item: AdminDirectoryItem) {
  if (typeof item.is_active === "boolean") return item.is_active ? "ACTIVE" : "PASSIVE";
  return String(item.status || item.membership_status || "ACTIVE").toUpperCase();
}

export function isDirectoryPersonRisky(item: AdminDirectoryItem) {
  if (item.role !== "MEMBER") return false;
  return Boolean(
    item.retention?.score ||
      item.retention_score ||
      item.retention?.reason ||
      item.retention?.reasom ||
      item.risk_reason ||
      item.risk_reasom ||
      item.risk_level_label
  );
}

export function getDirectoryRiskLabel(item: AdminDirectoryItem) {
  if (item.role === "TRAINER") return "Kazanç, tamamlanan ders ve yetkinlik detayları profil ekranında görüntülenir.";
  const reason = item.retention?.reason || item.retention?.reasom || item.risk_reason || item.risk_reasom;
  if (reason) return String(reason);
  if (isDirectoryPersonRisky(item)) return "Risk takibi gerekiyor";
  return "Son geliş ve paket kullanımı detay ekranında incelenmeli.";
}

export function filterAdminDirectory(
  items: AdminDirectoryItem[],
  options: { search: string; status: AdminDirectoryStatusFilter; role: AdminDirectoryRoleFilter },
) {
  const search = options.search.trim().toLocaleLowerCase("tr-TR");
  return items.filter((item) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    const haystack = `${fullName} ${item.phone || ""} ${item.email || ""}`.toLocaleLowerCase("tr-TR");
    const searchOk = !search || haystack.includes(search);
    const statusOk =
      options.status === "ALL" ||
      (options.status === "RISK" ? isDirectoryPersonRisky(item) : getDirectoryPersonStatus(item) === options.status);
    const roleOk = options.role === "ALL" || item.role === options.role;
    return searchOk && statusOk && roleOk;
  });
}

export function getAdminDirectoryMetrics(items: AdminDirectoryItem[]) {
  return {
    total: items.length,
    active: items.filter((item) => getDirectoryPersonStatus(item) === "ACTIVE").length,
    trainers: items.filter((item) => item.role === "TRAINER").length,
    members: items.filter((item) => item.role === "MEMBER").length,
  };
}
