import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { filterTrainerClients } from "@/lib/trainer-clients";

describe("trainer clients helper load behavior", () => {
  it("filters 500 clients by search and risk state without losing matches", () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      id: `member-${index + 1}`,
      full_name: index % 25 === 0 ? `Ayse Risk ${index + 1}` : `Member ${index + 1}`,
      phone: `0555${String(index).padStart(7, "0")}`,
      email: `member${index + 1}@example.com`,
      is_active: index % 7 !== 0,
      risk_reason: index % 25 === 0 ? "Devamsizlik" : null,
      risk_level_label: index % 40 === 0 ? "Yuksek" : null,
    }));

    const startedAt = performance.now();
    const searched = filterTrainerClients(rows, { query: "ayse", filter: "ALL" });
    const risky = filterTrainerClients(rows, { query: "", filter: "RISK" });
    const passive = filterTrainerClients(rows, { query: "", filter: "PASSIVE" });
    const elapsedMs = performance.now() - startedAt;

    expect(searched.length).toBeGreaterThan(10);
    expect(searched.every((row) => row.full_name.toLocaleLowerCase("tr").includes("ayse"))).toBe(true);
    expect(risky.every((row) => row.risk_reason || row.risk_level_label || row.retention_score)).toBe(true);
    expect(passive.every((row) => row.is_active === false)).toBe(true);
    expect(elapsedMs).toBeLessThan(80);
  });
});
