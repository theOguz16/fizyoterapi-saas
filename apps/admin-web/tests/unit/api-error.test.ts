import { describe, expect, it } from "vitest";
import { resolveApiError } from "@/lib/api-error";

describe("resolveApiError", () => {
  it("maps known API codes to localized UI copy", () => {
    expect(resolveApiError({ error: { code: "NO_TOKEN" } }, "fallback")).toBe(
      "Oturum bulunamadı. Lütfen tekrar giriş yapın."
    );
  });

  it("falls back to backend message for unmapped codes", () => {
    expect(resolveApiError({ error: { code: "CUSTOM", message: "Özel hata" } }, "fallback")).toBe("Özel hata");
  });

  it("returns the provided fallback for empty payloads", () => {
    expect(resolveApiError(null, "fallback")).toBe("fallback");
  });
});
