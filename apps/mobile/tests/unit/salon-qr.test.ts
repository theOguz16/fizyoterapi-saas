import { describe, expect, it } from "vitest";
import { extractSalonSlugFromQrPayload } from "../../src/lib/salon-qr";

describe("extractSalonSlugFromQrPayload", () => {
  it("reads slug from Detour params", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://fizyoflow.godetour.link/2IbxPluNu4?salon_slug=demo-salon&screen_path=%2F%28intake-member%29%2Fsalons%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from screen_path when salon_slug is missing", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://fizyoflow.godetour.link/2IbxPluNu4?screen_path=%2F%28intake-member%29%2Fsalons%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from web join path", () => {
    expect(
      extractSalonSlugFromQrPayload(
        "https://fizyoflow.godetour.link/2IbxPluNu4?web_join_path=%2Fjoin%2Fdemo-salon"
      )
    ).toBe("demo-salon");
  });

  it("reads slug from direct join url", () => {
    expect(extractSalonSlugFromQrPayload("https://fizyoflow.com/join/demo-salon?code=FYF-DEMO-SALON-001")).toBe(
      "demo-salon"
    );
  });

  it("reads slug from FizyoFlow FYF code", () => {
    expect(extractSalonSlugFromQrPayload("FYF-DEMO-SALON-001")).toBe("demo-salon");
  });

  it("reads slug from legacy CLN code", () => {
    expect(extractSalonSlugFromQrPayload("CLN-DEMO-SALON-001")).toBe("demo-salon");
  });

  it("ignores unrelated deep links", () => {
    expect(extractSalonSlugFromQrPayload("fizyoflow://member/home")).toBeNull();
  });
});
