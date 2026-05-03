import { resolveApiError } from "@/lib/api-error";
import { getApiBase as readApiBase } from "@/lib/api-base";

export async function httpRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${readApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = resolveApiError(payload as any, "İşlem sırasında bir hata oluştu");
    throw new Error(message);
  }

  return payload as T;
}

export function getApiBase() {
  return readApiBase();
}
