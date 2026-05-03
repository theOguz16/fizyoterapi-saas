const MISSING_API_BASE_MESSAGE =
  "NEXT_PUBLIC_API_URL tanımlı değil. Admin web için API taban adresi zorunludur.";

export function getApiBase() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiBase) {
    throw new Error(MISSING_API_BASE_MESSAGE);
  }

  return apiBase.replace(/\/+$/, "");
}

export function getMissingApiBaseMessage() {
  return MISSING_API_BASE_MESSAGE;
}
