import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "fizyoflow.biometric_login_enabled.v1";

export type BiometricState = {
  available: boolean;
  enabled: boolean;
  label: string;
};

function resolveBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Touch ID";
  return "Biyometrik giriş";
}

export async function getBiometricState(): Promise<BiometricState> {
  try {
    const [hasHardware, isEnrolled, types, enabled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
    ]);

    return {
      available: hasHardware && isEnrolled,
      enabled: enabled === "true",
      label: resolveBiometricLabel(types),
    };
  } catch {
    return { available: false, enabled: false, label: "Biyometrik giriş" };
  }
}

export async function enableBiometricLoginIfAvailable() {
  const state = await getBiometricState();
  if (!state.available) return state;
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  return { ...state, enabled: true };
}

export async function disableBiometricLogin() {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function authenticateWithBiometrics(label: string) {
  return LocalAuthentication.authenticateAsync({
    promptMessage: `${label} ile giriş yap`,
    cancelLabel: "Vazgeç",
    disableDeviceFallback: false,
    fallbackLabel: "Cihaz şifresini kullan",
  });
}
