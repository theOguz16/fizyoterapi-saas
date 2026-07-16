// Bu helper modulu mobil tarafta http client ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import Constants from "expo-constants";
import { ApiClientError, resolveApiError } from "./api-error";
import { markNetworkFailure, markNetworkSuccess } from "./connectivity";

let authToken: string | null = null;
let productAnalyticsHeaders: Record<string, string> = {};
const RESPONSE_ENVELOPE_HEADER = "X-FizyoFlow-Response-Envelope";

export type ApiPaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ApiSuccessEnvelope<T, TMeta extends Record<string, unknown> = Record<string, never>> = {
  data: T;
  message?: string;
  meta?: TMeta;
};

export type ApiDetailResponse<T> = ApiSuccessEnvelope<T>;
export type ApiListResponse<T> = ApiSuccessEnvelope<T[]>;
export type ApiPaginatedResponse<T> = ApiSuccessEnvelope<T[], { pagination: ApiPaginationMeta }>;

// Expo gelistirme ortaminda localhost cogu zaman telefondan gorunmez.
// Bu helper host'u manifestten okuyup API base URL'ini cihaza uygun hale getirir.
function readExpoHostCandidate() {
  const candidates = [
    (Constants.expoConfig as { hostUri?: string } | null | undefined)?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
    (Constants as any)?.manifest?.hostUri,
    typeof Constants.linkingUri === "string" ? Constants.linkingUri : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;

    const cleaned = candidate.replace(/^exp:\/\//, "").replace(/^http:\/\//, "").replace(/^https:\/\//, "");
    const host = cleaned.split("/")[0]?.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }

  return null;
}

function buildApiBase() {
  const configuredBase = (process.env.EXPO_PUBLIC_API_BASE || "").trim();
  const detectedHost = readExpoHostCandidate();
  const isDevBuild = typeof __DEV__ !== "undefined" && __DEV__;

  if (configuredBase) {
    try {
      const url = new URL(configuredBase);
      // Env'de localhost birakilsa bile gercek cihazda makine IP'sine ceviriyoruz.
      if (detectedHost && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
        url.hostname = detectedHost;
        return url.toString().replace(/\/$/, "");
      }
      if (!detectedHost && url.hostname === "127.0.0.1") {
        url.hostname = "localhost";
        return url.toString().replace(/\/$/, "");
      }
      return configuredBase.replace(/\/$/, "");
    } catch {
      return configuredBase.replace(/\/$/, "");
    }
  }

  if (detectedHost) {
    return `http://${detectedHost}:4949/api`;
  }

  return isDevBuild ? "http://localhost:4949/api" : "https://api.fizyoflow.com/api";
}

const API_BASE = buildApiBase();

export function getApiBase() {
  return API_BASE;
}

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setProductAnalyticsHeaders(input: { installId?: string | null; sessionId?: string | null; funnelId?: string | null }) {
  productAnalyticsHeaders = {
    ...(input.installId ? { "X-FizyoFlow-Install-ID": input.installId } : {}),
    ...(input.sessionId ? { "X-FizyoFlow-Session-ID": input.sessionId } : {}),
    ...(input.funnelId ? { "X-FizyoFlow-Funnel-ID": input.funnelId } : {}),
  };
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
};

function isSuccessEnvelope(payload: unknown): payload is ApiSuccessEnvelope<unknown> {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      Object.prototype.hasOwnProperty.call(payload, "data")
  );
}

async function requestEnvelope<T, TMeta extends Record<string, unknown> = Record<string, never>>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiSuccessEnvelope<T, TMeta>> {
  const { method = "GET", body, headers = {}, auth = true, signal } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    [RESPONSE_ENVELOPE_HEADER]: "1",
    ...productAnalyticsHeaders,
    ...headers,
  };

  if (auth && authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    // Tum mobil istekler tek bir HTTP gecidinden geciyor.
    // Ortak hata donusleri ve auth header davranisi burada toplaniyor.
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "İstek zaman aşımına uğradı. Lütfen tekrar deneyin."
        : "Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.";
    markNetworkFailure(message);
    throw new ApiClientError(message, 0, "NETWORK_REQUEST_FAILED");
  }

  markNetworkSuccess();

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = resolveApiError(payload, "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
    const code = payload?.error?.code;
    throw new ApiClientError(message, response.status, code);
  }

  if (!isSuccessEnvelope(payload)) {
    throw new ApiClientError("Sunucudan beklenmeyen bir yanıt alındı. Lütfen tekrar deneyin.", response.status, "INVALID_API_RESPONSE");
  }

  return payload as ApiSuccessEnvelope<T, TMeta>;
}

export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await requestEnvelope<T>(path, options);
  return envelope.data;
}

export function httpRequestEnvelope<T, TMeta extends Record<string, unknown> = Record<string, never>>(
  path: string,
  options: RequestOptions = {}
) {
  return requestEnvelope<T, TMeta>(path, options);
}

export function createTimeoutSignal(ms: number) {
  // React Query ve manuel fetch'lerde ayni timeout davranisini kullanmak icin
  // abort signal yardimcisi disari aciliyor.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}
