import { describe, expect, it } from "vitest";
import { ApiClientError, resolveApiError } from "@/lib/api-error";

describe("mobile api errors", () => {
  it("maps known codes to product copy", () => {
    expect(resolveApiError({ error: { code: "INVALID_LOGIN" } }, "fallback")).toBe("E-posta veya şifre hatalı.");
  });

  it("falls back to payload message for unknown codes", () => {
    expect(resolveApiError({ error: { code: "X", message: "Özel mesaj" } }, "fallback")).toBe("Özel mesaj");
  });

  it("keeps ApiClientError status and code metadata", () => {
    const error = new ApiClientError("boom", 401, "INVALID_TOKEN");
    expect(error.message).toBe("boom");
    expect(error.status).toBe(401);
    expect(error.code).toBe("INVALID_TOKEN");
  });
});
