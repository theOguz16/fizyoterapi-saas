import { describe, expect, it } from "vitest";
import { extractSalonSlugFromQrPayload } from "../../src/lib/salon-qr";

describe("extractSalonSlugFromQrPayload", () => {
  it("reads slug from Detour params", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://clinerva.godetour.link/2IbxPluNu4?salon_slug=demo-salon&screen_path=%2F%28intake-member%29%2Fsalons%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from screen_path when salon_slug is missing", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://clinerva.godetour.link/2IbxPluNu4?screen_path=%2F%28intake-member%29%2Fsalons%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from web join path", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://clinerva.godetour.link/2IbxPluNu4?web_join_path=%2Fjoin%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from direct join url", () => {
    expect(extractSalonSlugFromQrPayload("https://clinerva.com/join/demo-salon?code=CLN-DEMO-SALON-001")).toBe(
      "demo-salon"
    );
  });

  it("reads slug from legacy CLN code", () => {
    expect(extractSalonSlugFromQrPayload("CLN-DEMO-SALON-001")).toBe("demo-salon");
  });

  it("ignores unrelated deep links", () => {
    expect(extractSalonSlugFromQrPayload("clinerva://member/home")).toBeNull();
  });
});