import { Alert } from "react-native";

export function getUserFacingMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

export function showInfoAlert(title: string, message: string) {
  Alert.alert(title, message);
}

export function showErrorAlert(title: string, error: unknown, fallback: string) {
  Alert.alert(title, getUserFacingMessage(error, fallback));
}
