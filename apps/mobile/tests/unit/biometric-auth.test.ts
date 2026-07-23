import { describe, expect, it } from "vitest";
import { resolveBiometricLabel, shouldAttemptBiometricLogin } from "@/lib/biometric-login-policy";

describe("biometric login policy", () => {
  it("uses platform-appropriate fingerprint labels", () => {
    expect(resolveBiometricLabel({ hasFacialRecognition: false, hasFingerprint: true, platform: "ios" })).toBe("Touch ID");
    expect(resolveBiometricLabel({ hasFacialRecognition: false, hasFingerprint: true, platform: "android" })).toBe("Parmak izi");
  });

  it("prefers Face ID when facial recognition is available", () => {
    expect(resolveBiometricLabel({ hasFacialRecognition: true, hasFingerprint: true, platform: "ios" })).toBe("Face ID");
  });

  it("automatically attempts biometrics only once when ready", () => {
    expect(shouldAttemptBiometricLogin({ available: true, enabled: true, alreadyAttempted: false, loading: false })).toBe(true);
    expect(shouldAttemptBiometricLogin({ available: true, enabled: true, alreadyAttempted: true, loading: false })).toBe(false);
    expect(shouldAttemptBiometricLogin({ available: false, enabled: true, alreadyAttempted: false, loading: false })).toBe(false);
    expect(shouldAttemptBiometricLogin({ available: true, enabled: false, alreadyAttempted: false, loading: false })).toBe(false);
    expect(shouldAttemptBiometricLogin({ available: true, enabled: true, alreadyAttempted: false, loading: true })).toBe(false);
  });
});
