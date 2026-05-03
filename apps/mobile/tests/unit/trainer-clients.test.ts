import { describe, expect, it } from "vitest";
import { filterTrainerClients, isTrainerClientRisky, matchesTrainerClientSearch } from "@/lib/trainer-clients";

const rows = [
  {
    id: "1",
    full_name: "Ayse Demir",
    phone: "05551234567",
    email: "ayse@example.com",
    is_active: true,
  },
  {
    id: "2",
    full_name: "Mehmet Kaya",
    phone: "05330001122",
    email: "mehmet@example.com",
    is_active: false,
    risk_reason: "Uzun süredir katılım yok",
  },
];

describe("trainer clients helpers", () => {
  it("matches name, phone and email search", () => {
    expect(matchesTrainerClientSearch(rows[0], "ayse")).toBe(true);
    expect(matchesTrainerClientSearch(rows[0], "555123")).toBe(true);
    expect(matchesTrainerClientSearch(rows[0], "example.com")).toBe(true);
    expect(matchesTrainerClientSearch(rows[0], "mehmet")).toBe(false);
  });

  it("filters by passive and risk states", () => {
    expect(filterTrainerClients(rows, { query: "", filter: "PASSIVE" })).toEqual([rows[1]]);
    expect(filterTrainerClients(rows, { query: "", filter: "RISK" })).toEqual([rows[1]]);
  });

  it("detects risk through fallback fields and keeps active filter deterministic", () => {
    const typoRiskRow = {
      id: "3",
      full_name: "Selin Yilmaz",
      email: "selin@example.com",
      is_active: true,
      risk_reasom: "Eski typo alanı dolu",
    };

    expect(isTrainerClientRisky(typoRiskRow)).toBe(true);
    expect(filterTrainerClients([...rows, typoRiskRow], { query: "", filter: "ACTIVE" }).map((row) => row.id)).toEqual(["1", "3"]);
  });

  it("treats retention_score as risky and trims Turkish locale searches", () => {
    const retentionRow = {
      id: "4",
      full_name: "İrem Aksoy",
      email: "irem@example.com",
      phone: "05000000000",
      is_active: true,
      retention_score: 42,
    };

    expect(isTrainerClientRisky(retentionRow)).toBe(true);
    expect(matchesTrainerClientSearch(retentionRow, "  irem  ")).toBe(true);
  });
});
