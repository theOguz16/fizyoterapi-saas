// Bu helper modulu mobil tarafta trainer clients ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import type { TrainerClientSummary } from "@fitnes-saas/contracts";

export type TrainerClientFilter = "ALL" | "ACTIVE" | "PASSIVE" | "RISK";

export function isTrainerClientRisky(item: TrainerClientSummary) {
  return Boolean(item.retention_score || item.risk_reason || item.risk_reasom || item.risk_level_label);
}

export function matchesTrainerClientSearch(item: TrainerClientSummary, query: string) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("tr");
  if (!normalizedQuery) return true;

  return [item.full_name, item.phone, item.email].some((field) =>
    String(field || "")
      .toLocaleLowerCase("tr")
      .includes(normalizedQuery)
  );
}

export function filterTrainerClients(items: TrainerClientSummary[], options: { query: string; filter: TrainerClientFilter }) {
  return items.filter((item) => {
    if (!matchesTrainerClientSearch(item, options.query)) return false;
    if (options.filter === "ACTIVE") return item.is_active !== false;
    if (options.filter === "PASSIVE") return item.is_active === false;
    if (options.filter === "RISK") return isTrainerClientRisky(item);
    return true;
  });
}

export function getTrainerClientMetrics(items: TrainerClientSummary[]) {
  return {
    total: items.length,
    active: items.filter((item) => item.is_active !== false).length,
    risky: items.filter(isTrainerClientRisky).length,
  };
}
