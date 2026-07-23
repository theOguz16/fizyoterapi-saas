import { Alert } from "react-native";

const TECHNICAL_ERROR_PATTERNS = [
  /RevenueCat/i,
  /webhook/i,
  /SDK/i,
  /offering/i,
  /underlying error/i,
  /configuration/i,
  /API key/i,
  /store product/i,
  /native module/i,
];

export function getUserFacingMessage(error: unknown, fallback: string) {
  const message = typeof error === "string" ? error.trim() : error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  if (message.length > 220) return fallback;
  return message;
}

export function showInfoAlert(title: string, message: string) {
  Alert.alert(title, message);
}

export function showErrorAlert(title: string, error: unknown, fallback: string) {
  Alert.alert(title, getUserFacingMessage(error, fallback));
}

/** A committed server action must not look failed merely because session refresh is unavailable. */
export async function refreshSessionAfterCommittedAction(refreshMe: () => Promise<unknown>, actionLabel = "İşlem") {
  try {
    await refreshMe();
    return true;
  } catch {
    showInfoAlert(
      `${actionLabel} tamamlandı`,
      "İşlem sunucuda kaydedildi ancak oturum bilgisi şu anda yenilenemedi. Ekranı yenileyebilir veya tekrar giriş yapabilirsin."
    );
    return false;
  }
}
