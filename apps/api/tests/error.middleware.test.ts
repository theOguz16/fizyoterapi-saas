import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError";
import { errorMiddleware } from "../middlewares/error.middleware";

function createResponse() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

describe("errorMiddleware", () => {
  it("maps AppError codes to catalog copy", () => {
    const res = createResponse();

    errorMiddleware(new AppError("NO_TOKEN", 401, "fallback"), {} as any, res as any, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: "NO_TOKEN",
        message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      },
    });
  });

  it("returns a generic internal error for unexpected exceptions", () => {
    const res = createResponse();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorMiddleware(new Error("boom"), {} as any, res as any, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Sunucu hatası",
      },
    });

    consoleSpy.mockRestore();
  });
});
