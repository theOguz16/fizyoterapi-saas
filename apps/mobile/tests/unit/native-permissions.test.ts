import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("native release permissions", () => {
  it("removes the camera dependency's audio permission from Android release merges", () => {
    const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");
    const cameraManifest = readFileSync(
      resolve(require.resolve("expo-camera/package.json"), "../android/src/main/AndroidManifest.xml"),
      "utf8"
    );

    expect(manifest).toContain("android.permission.CAMERA");
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(cameraManifest).toContain("android.permission.RECORD_AUDIO");
    expect(manifest).toMatch(
      /android:name="android\.permission\.RECORD_AUDIO"\s+tools:node="remove"/
    );
    expect(manifest).not.toContain("android.permission.SYSTEM_ALERT_WINDOW");
    expect(manifest).not.toContain("android:requestLegacyExternalStorage");
  });

  it("requests only foreground location and no microphone access on iOS", () => {
    const plist = readProjectFile("ios/FizyoFlow/Info.plist");

    expect(plist).toContain("NSCameraUsageDescription");
    expect(plist).toContain("NSLocationWhenInUseUsageDescription");
    expect(plist).not.toContain("NSLocationAlwaysUsageDescription");
    expect(plist).not.toContain("NSLocationAlwaysAndWhenInUseUsageDescription");
    expect(plist).not.toContain("NSMicrophoneUsageDescription");
    expect(plist).toContain("NSPhotoLibraryAddUsageDescription");
    expect(plist).not.toContain("NSPhotoLibraryUsageDescription");
  });

  it("keeps Expo prebuild permission options narrowed", () => {
    const expoConfig = readProjectFile("app.config.ts");

    expect(expoConfig).toMatch(/microphonePermission:\s*false/);
    expect(expoConfig).toMatch(/recordAudioAndroid:\s*false/);
    expect(expoConfig).toMatch(/locationAlwaysPermission:\s*false/);
    expect(expoConfig).toMatch(/locationAlwaysAndWhenInUsePermission:\s*false/);
    expect(expoConfig).toMatch(/isIosBackgroundLocationEnabled:\s*false/);
    expect(expoConfig).toMatch(/isAndroidBackgroundLocationEnabled:\s*false/);
    expect(expoConfig).toMatch(/photosPermission:\s*false/);
    expect(expoConfig).toMatch(/granularPermissions:\s*\["photo"\]/);
    expect(expoConfig).toContain('delete application.$["android:requestLegacyExternalStorage"]');
  });

  it("requests write-only media access for QR export", () => {
    const clinicQr = readProjectFile("app/(admin)/clinic-qr.tsx");

    expect(clinicQr).toContain("MediaLibrary.requestPermissionsAsync(true)");
  });
});
