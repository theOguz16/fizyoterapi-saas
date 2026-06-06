/// <reference types="node" />

import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "FizyoFlow",
  slug: "fizyoflow-mobile",
  scheme: "fizyoflow",
  version: "1.0.1",
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: {
      projectId: "07e2b25e-9cd1-4ad6-9b99-3275b5b79176",
    },
    detour: {
      apiKey: process.env.EXPO_PUBLIC_DETOUR_API_KEY?.trim() || null,
      appID: process.env.EXPO_PUBLIC_DETOUR_APP_ID?.trim() || null,
    },
  },
};

export default config;
