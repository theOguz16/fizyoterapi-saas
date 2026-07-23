/// <reference types="node" />

import type { ExpoConfig } from "expo/config";
import { AndroidConfig, type ConfigPlugin, withAndroidManifest } from "expo/config-plugins";

const CAMERA_PERMISSION = "FizyoFlow, klinik QR ve danışan giriş kodlarını okutmak için kameraya erişim ister.";
const LOCATION_PERMISSION =
  "FizyoFlow, klinik keşfi sırasında yakın klinikleri öne almak için konumuna erişim ister.";
const SAVE_PHOTOS_PERMISSION = "FizyoFlow, klinik QR görsellerini galeriye kaydetmek için izin ister.";

const withScopedMediaStorage: ConfigPlugin = (expoConfig) =>
  withAndroidManifest(expoConfig, (manifestConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
    delete application.$["android:requestLegacyExternalStorage"];
    return manifestConfig;
  });

const config: ExpoConfig = {
  name: "FizyoFlow",
  slug: "fizyoflow-mobile",
  scheme: "fizyoflow",
  version: "1.0.4",
  ios: {
    bundleIdentifier: "com.fizyoflow.mobile",
    associatedDomains: ["applinks:fizyoflow.com", "applinks:www.fizyoflow.com"],
  },
  android: {
    package: "com.fizyoflow.mobile",
  },
  experiments: {
    typedRoutes: false,
  },
  plugins: [
    [
      "expo-camera",
      {
        cameraPermission: CAMERA_PERMISSION,
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: LOCATION_PERMISSION,
        locationAlwaysPermission: false,
        locationAlwaysAndWhenInUsePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: false,
        savePhotosPermission: SAVE_PHOTOS_PERMISSION,
        granularPermissions: ["photo"],
        isAccessMediaLocationEnabled: false,
      },
    ],
  ],
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

export default withScopedMediaStorage(config);
