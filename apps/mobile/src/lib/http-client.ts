// Bu helper modulu mobil tarafta http client ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import Constants from "expo-constants";
import { ApiClientError, resolveApiError } from "./api-error";

let authToken: string | null = null;

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

  if (configuredBase) {
    try {
      const url = new URL(configuredBase);
      // Env'de localhost birakilsa bile gercek cihazda makine IP'sine ceviriyoruz.
      if (detectedHost && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
        url.hostname = detectedHost;
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

  return "http://localhost:4949/api";
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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
  unwrapData?: boolean;
};

export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, auth = true, signal, unwrapData = true } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
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
        : `API'ye baglanilamadi. Mobil istemci su anda ${API_BASE} adresini kullaniyor.`;
    throw new ApiClientError(message, 0, "NETWORK_REQUEST_FAILED");
  }

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

  return (unwrapData ? (payload?.data ?? payload) : payload) as T;
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
