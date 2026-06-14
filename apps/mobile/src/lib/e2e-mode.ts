export function isE2EModeEnabled() {
  return __DEV__ || process.env.EXPO_PUBLIC_E2E_MODE === "1";
}
