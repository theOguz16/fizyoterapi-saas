import { useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setAuthToken } from "@/lib/http-client";
import { resetConnectivityForE2E } from "@/lib/connectivity";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { resetLocalPreferencesForE2E } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";

const TOKEN_KEY = "fizyoflow.access_token";

export default function E2EResetScreen() {
  const e2eEnabled = isE2EModeEnabled();
  const router = useRouter();

  useEffect(() => {
    if (!e2eEnabled) return;

    void (async () => {
      setAuthToken(null);
      resetConnectivityForE2E();
      await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), resetLocalPreferencesForE2E()]);
      router.replace("/" as never);
    })();
  }, [e2eEnabled, router]);

  if (!e2eEnabled) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={tokens.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
  },
});
