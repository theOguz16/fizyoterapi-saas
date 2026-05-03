import type { Config } from "@swmansion/react-native-detour";

export const detourConfig: Config = {
  apiKey: process.env.EXPO_PUBLIC_DETOUR_API_KEY || "",
  appID: process.env.EXPO_PUBLIC_DETOUR_APP_ID || "",
  shouldUseClipboard: true,
};

export function isDetourConfigured() {
  return Boolean(detourConfig.apiKey && detourConfig.appID);
}