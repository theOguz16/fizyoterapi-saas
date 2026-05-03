// Bu helper modulu mobil tarafta trainer risk ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type TrainerRiskRow = {
  member_id?: string | null;
  id?: string | null;
  member_full_name?: string | null;
  full_name?: string | null;
  risk_score?: number | null;
  score?: number | null;
  risk_level_label?: string | null;
  level?: string | null;
  reason?: string | null;
};

export function normalizeTrainerRiskRows(rows: TrainerRiskRow[]) {
  return rows.map((row, index) => ({
    key: row.member_id || row.id || `risk-${index}`,
    name: row.member_full_name || row.full_name || row.member_id || "Danışan",
    score: row.risk_score ?? row.score ?? "-",
    level: row.risk_level_label || row.level || "Takip",
    reason: row.reason || null,
  }));
}
