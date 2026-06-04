import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadHttpClientModule() {
  vi.resetModules();
  vi.stubGlobal("__DEV__", false);
  vi.doMock("expo-constants", () => ({
    default: {
      expoConfig: null,
      manifest2: null,
      manifest: null,
      linkingUri: null,
    },
  }));

  return import("@/lib/http-client");
}

async function loadDevHttpClientModule() {
  vi.resetModules();
  vi.stubGlobal("__DEV__", true);
  vi.doMock("expo-constants", () => ({
    default: {
      expoConfig: null,
      manifest2: null,
      manifest: null,
      linkingUri: null,
    },
  }));

  return import("@/lib/http-client");
}

describe("mobile http client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.doUnmock("expo-constants");
  });

  it("adds bearer token and unwraps data payloads", async () => {
    const { httpRequest, setAuthToken } = await loadHttpClientModule();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-1");

    const result = await httpRequest<{ ok: boolean }>("/member/home");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.fizyoflow.com/api/member/home",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("keeps localhost fallback only for development builds", async () => {
    const { httpRequest } = await loadDevHttpClientModule();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpRequest<{ ok: boolean }>("/member/home")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4949/api/member/home", expect.any(Object));
  });

  it("supports raw payload mode without data unwrapping", async () => {
    const { httpRequest } = await loadHttpClientModule();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpRequest<{ ok: boolean }>("/auth/login", { unwrapData: false, auth: false });

    expect(result).toEqual({ ok: true });
  });

  it("throws ApiClientError with mapped message for failed responses", async () => {
    const { httpRequest } = await loadHttpClientModule();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: { code: "INVALID_LOGIN" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpRequest("/auth/login", { method: "POST", auth: false })).rejects.toEqual(
      expect.objectContaining({
        message: "E-posta veya şifre hatalı.",
        status: 401,
        code: "INVALID_LOGIN",
      })
    );
  });

  it("throws a user-facing network error when the API cannot be reached", async () => {
    const { httpRequest } = await loadHttpClientModule();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(httpRequest("/member/home")).rejects.toEqual(
      expect.objectContaining({
        message: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.",
        status: 0,
        code: "NETWORK_REQUEST_FAILED",
      })
    );
  });

  it("updates connectivity status around network failures and recovery", async () => {
    const { httpRequest } = await loadHttpClientModule();
    const { getConnectivitySnapshot } = await import("@/lib/connectivity");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { ok: true } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpRequest("/member/home")).rejects.toMatchObject({ code: "NETWORK_REQUEST_FAILED" });
    expect(getConnectivitySnapshot().status).toBe("offline");

    await expect(httpRequest("/member/home")).resolves.toEqual({ ok: true });
    expect(getConnectivitySnapshot().status).toBe("online");
  });

  it("creates abortable timeout signals", async () => {
    vi.useFakeTimers();
    const { createTimeoutSignal } = await loadHttpClientModule();
    const { signal, clear } = createTimeoutSignal(250);

    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(250);
    expect(signal.aborted).toBe(true);

    clear();
  });

  it("handles 500 concurrent requests with stable auth headers", async () => {
    const { httpRequest, setAuthToken } = await loadHttpClientModule();
    const fetchMock = vi.fn().mockImplementation(async (_url, options?: RequestInit) => ({
      ok: true,
      json: async () => ({
        data: {
          authorization: (options?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("bulk-token");

    const startedAt = performance.now();
    const responses = await Promise.all(
      Array.from({ length: 500 }, (_, index) => httpRequest<{ authorization: string }>(`/member/home?i=${index}`))
    );
    const elapsedMs = performance.now() - startedAt;

    expect(responses).toHaveLength(500);
    expect(responses.every((row) => row.authorization === "Bearer bulk-token")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(500);
    expect(elapsedMs).toBeLessThan(250);
  });
});
