export function resolveBiometricLabel(input: {
  hasFacialRecognition: boolean;
  hasFingerprint: boolean;
  platform: string;
}) {
  if (input.hasFacialRecognition) return "Face ID";
  if (input.hasFingerprint) return input.platform === "android" ? "Parmak izi" : "Touch ID";
  return "Biyometrik giriş";
}

export function shouldAttemptBiometricLogin(input: {
  available: boolean;
  enabled: boolean;
  alreadyAttempted: boolean;
  loading: boolean;
}) {
  return input.available && input.enabled && !input.alreadyAttempted && !input.loading;
}
