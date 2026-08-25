import { describe, expect, it } from "vitest";
import { ApiClientError, normalizeApiError, queryRetryDelay, resolveApiError, resolveHttpStatusMessage, shouldRetryQuery } from "@/lib/api-error";

describe("mobile api errors", () => {
  it("maps known codes to product copy", () => {
    expect(resolveApiError({ error: { code: "INVALID_LOGIN" } }, "fallback")).toBe("E-posta veya şifre hatalı.");
  });

  it("uses clinic terminology instead of legacy salon wording", () => {
    expect(resolveApiError({ error: { code: "INVALID_TENANT", message: "Salon bulunamadı." } }, "fallback")).toBe(
      "Klinik bulunamadı."
    );
  });

  it("preserves the safe public copy for a missing salon", () => {
    expect(resolveApiError({ error: { code: "SALON_NOT_FOUND", message: "Salon bulunamadı" } }, "fallback")).toBe(
      "Salon bulunamadı"
    );
  });

  it("does not expose internal tenant or auth wording for known codes", () => {
    expect(
      resolveApiError(
        { error: { code: "NO_TENANT_OR_AUTH", message: "Tenant veya auth bilgisi bulunamadı" } },
        "fallback"
      )
    ).toBe("Klinik veya oturum bilgisine ulaşılamadı. Lütfen tekrar giriş yapın.");
  });

  it("uses consistent Danışan and Eğitmen terminology", () => {
    expect(resolveApiError({ error: { code: "MEMBER_MEASUREMENTS_LIST_ERROR" } }, "fallback")).toBe(
      "Danışan ölçüm geçmişi getirilemedi."
    );
    expect(resolveApiError({ error: { code: "PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND" } }, "fallback")).toBe(
      "Bu paket için uygun eğitmen ataması bulunamadı."
    );
  });

  it("replaces known internal failures with a safe retry message", () => {
    expect(resolveApiError({ error: { code: "INTERNAL_ERROR", message: "Sunucu hatası" } }, "fallback")).toBe(
      "Bir sorun oluştu. Lütfen tekrar deneyin."
    );
  });

  it("does not expose payload messages for unknown non-empty codes", () => {
    expect(resolveApiError(
      { error: { code: "DATABASE_DRIVER_ERROR", message: "relation users does not exist" } },
      "İşlem tamamlanamadı."
    )).toBe("İşlem tamamlanamadı.");
  });

  it("keeps message-only payload compatibility when the backend sends no code", () => {
    expect(resolveApiError({ error: { message: "İşlem için ek onay gerekiyor." } }, "fallback")).toBe(
      "İşlem için ek onay gerekiyor."
    );
  });

  it("keeps ApiClientError status and code metadata", () => {
    const error = new ApiClientError("boom", 401, "INVALID_TOKEN");
    expect(error.message).toBe("boom");
    expect(error.status).toBe(401);
    expect(error.code).toBe("INVALID_TOKEN");
  });

  it("maps HTTP status fallbacks without exposing technical responses", () => {
    expect(resolveHttpStatusMessage(400, "fallback")).toContain("bilgiler geçerli değil");
    expect(resolveHttpStatusMessage(401, "fallback")).toContain("Oturumun sona");
    expect(resolveHttpStatusMessage(403, "fallback")).toBe("Bu işlem için yetkiniz yok.");
    expect(resolveHttpStatusMessage(404, "fallback")).toContain("kayıt bulunamadı");
    expect(resolveHttpStatusMessage(408, "fallback")).toContain("zaman aşımına");
    expect(resolveHttpStatusMessage(409, "fallback")).toContain("zaten yapılmış");
    expect(resolveHttpStatusMessage(422, "fallback")).toContain("doğrulanamadı");
    expect(resolveHttpStatusMessage(429, "fallback")).toContain("Çok hızlı");
    expect(resolveHttpStatusMessage(500, "fallback")).toContain("Sunucuda geçici");
  });

  it("normalizes transport and HTTP failures into stable UI categories", () => {
    expect(normalizeApiError(new ApiClientError("fetch failed", 0, "NETWORK_REQUEST_FAILED"))).toMatchObject({ kind: "offline", retryable: true });
    expect(normalizeApiError(new ApiClientError("timeout", 408, "REQUEST_TIMEOUT"))).toMatchObject({ kind: "timeout", retryable: true });
    expect(normalizeApiError(new ApiClientError("secret", 401, "INVALID_TOKEN"))).toMatchObject({ kind: "unauthorized", retryable: false });
    expect(normalizeApiError(new ApiClientError("db detail", 503))).toMatchObject({ kind: "server", retryable: true });
  });

  it("keeps validation field metadata without exposing a raw response", () => {
    const error = new ApiClientError("invalid", 422, "VALIDATION_ERROR", {
      error: { code: "VALIDATION_ERROR", fields: { email: "Geçerli bir e-posta gir." } },
    });
    expect(normalizeApiError(error)).toMatchObject({
      kind: "validation",
      fieldErrors: { email: "Geçerli bir e-posta gir." },
    });
  });

  it("retries only transient failures with a bounded backoff", () => {
    expect(shouldRetryQuery(0, new ApiClientError("offline", 0, "NETWORK_REQUEST_FAILED"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError("server", 503))).toBe(true);
    expect(shouldRetryQuery(2, new ApiClientError("server", 503))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError("forbidden", 403))).toBe(false);
    expect(queryRetryDelay(0)).toBe(750);
    expect(queryRetryDelay(99)).toBe(8000);
  });
});
