import { describe, expect, it } from "vitest";
import { buildSalonServiceHighlights, getSalonDiscoveryEmptyGuidance, resolveMemberSalonConnection } from "@/lib/salon-discovery";

describe("salon discovery helpers", () => {
  it("keeps only the most purchased visible service", () => {
    const result = buildSalonServiceHighlights({
      id: "salon-1",
      slug: "demo",
      name: "Demo Salon",
      services: [
        { title: "Pilates", starting_price: 1200, summary: "Kontrollu akış", active_member_count: 3 },
        { title: "Reformer", starting_price: 1800, summary: "Makine destekli çalışma", active_member_count: 11 },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        title: "Reformer",
        priceLabel: "1800 TL",
      }),
    ]);
    expect(result[0]?.description).toContain("11 aktif paket sahibi");
  });

  it("keeps a clinic link primary and treats discovery as a fallback", () => {
    expect(resolveMemberSalonConnection(" Demo-Salon ")).toEqual({
      kind: "CONNECTED_LINK",
      slug: "demo-salon",
      route: "/(intake-member)/salons/demo-salon",
    });
    expect(resolveMemberSalonConnection(null)).toEqual({
      kind: "CONNECTION_REQUIRED",
      slug: null,
      route: null,
    });
  });

  it("directs an empty marketplace back to the clinic QR flow", () => {
    expect(getSalonDiscoveryEmptyGuidance(false, false)).toMatchObject({ action: "SCAN_QR" });
    expect(getSalonDiscoveryEmptyGuidance(true, true)).toMatchObject({ action: "CLEAR_FILTERS" });
  });
});
