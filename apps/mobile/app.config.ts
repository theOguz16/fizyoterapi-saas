/// <reference types="node" />

import type { ExpoConfig } from "expo/config";
import appJson from "./app.json";

const baseConfig = appJson.expo as ExpoConfig;

const plugins = [...(baseConfig.plugins || [])].filter((plugin) => {
  if (typeof plugin === "string") {
    return plugin !== "react-native-purchases";
  }

  return plugin?.[0] !== "react-native-purchases";
});

const config: ExpoConfig = {
  ...baseConfig,
  plugins,
  extra: {
    ...(baseConfig.extra || {}),
    detour: {
      apiKey: process.env.EXPO_PUBLIC_DETOUR_API_KEY?.trim() || null,
      appID: process.env.EXPO_PUBLIC_DETOUR_APP_ID?.trim() || null,
    },
  },
};

export default config;