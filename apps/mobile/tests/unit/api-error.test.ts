import { describe, expect, it } from "vitest";
import { ApiClientError, resolveApiError } from "@/lib/api-error";

describe("mobile api errors", () => {
  it("maps known codes to product copy", () => {
    expect(resolveApiError({ error: { code: "INVALID_LOGIN" } }, "fallback")).toBe("E-posta veya şifre hatalı.");
  });

  it("uses clinic terminology instead of legacy salon wording", () => {
    expect(resolveApiError({ error: { code: "INVALID_TENANT", message: "Salon bulunamadı." } }, "fallback")).toBe(
      "Klinik bulunamadı."
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
});
