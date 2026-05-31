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

const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
if (sentryOrg && sentryProject) {
  plugins.push([
    "@sentry/react-native/expo",
    {
      organization: sentryOrg,
      project: sentryProject,
      url: process.env.SENTRY_URL?.trim() || "https://sentry.io/",
    },
  ] as any);
}

const config: ExpoConfig = {
  ...baseConfig,
  plugins,
  extra: {
    ...(baseConfig.extra || {}),
    eas: {
      ...((baseConfig.extra as any)?.eas || {}),
      projectId: "07e2b25e-9cd1-4ad6-9b99-3275b5b79176",
    },
    detour: {
      apiKey: process.env.EXPO_PUBLIC_DETOUR_API_KEY?.trim() || null,
      appID: process.env.EXPO_PUBLIC_DETOUR_APP_ID?.trim() || null,
    },
  },
};

export default config;
