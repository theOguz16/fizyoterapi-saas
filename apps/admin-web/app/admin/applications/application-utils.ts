export type ApplicationStageFilter = "ALL" | "PENDING" | "PAYMENT" | "JOINED" | "REJECTED";

type ApplicationLike = {
  status: string;
  payment_status: string;
};

export function applicationStageLabel(row: ApplicationLike) {
  if (row.status === "REJECTED") return "Reddedildi";
  if (row.status === "APPROVED" && row.payment_status === "VERIFIED") return "Salona Katıldı";
  if (row.status === "APPROVED") return "Ödeme Bekliyor";
  return "Başvurdu";
}

export function applicationStageVariant(row: ApplicationLike) {
  if (row.status === "REJECTED") return "danger" as const;
  if (row.status === "APPROVED" && row.payment_status === "VERIFIED") return "success" as const;
  if (row.status === "APPROVED") return "warning" as const;
  return "secondary" as const;
}

export function parseApplicationNote(note?: string | null) {
  return String(note || "")
    .split(/\s*[•·]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function filterApplicationsByStage<T extends ApplicationLike>(rows: T[], stageFilter: ApplicationStageFilter) {
  return rows.filter((row) => {
    if (stageFilter === "ALL") return true;
    if (stageFilter === "PENDING") return row.status === "PENDING";
    if (stageFilter === "PAYMENT") return row.status === "APPROVED" && row.payment_status !== "VERIFIED";
    if (stageFilter === "JOINED") return row.status === "APPROVED" && row.payment_status === "VERIFIED";
    return row.status === "REJECTED";
  });
}
