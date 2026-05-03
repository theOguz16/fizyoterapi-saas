import { describe, expect, it } from "vitest";
import { normalizeTrainerRiskRows } from "@/lib/trainer-risk";

describe("trainer risk helpers", () => {
  it("normalizes mobile trainer risk rows", () => {
    expect(
      normalizeTrainerRiskRows([
        {
          member_id: "member-1",
          member_full_name: "Demo Member",
          risk_score: 72,
          risk_level_label: "Yüksek",
        },
        {
          id: "risk-2",
          full_name: "Fallback Member",
          score: 40,
          level: "Takip",
        },
      ])
    ).toEqual([
      { key: "member-1", name: "Demo Member", score: 72, level: "Yüksek", reason: null },
      { key: "risk-2", name: "Fallback Member", score: 40, level: "Takip", reason: null },
    ]);
  });

  it("keeps deterministic fallback labels for empty rows", () => {
    expect(normalizeTrainerRiskRows([{} as any])).toEqual([
      { key: "risk-0", name: "Danışan", score: "-", level: "Takip", reason: null },
    ]);
  });
});
