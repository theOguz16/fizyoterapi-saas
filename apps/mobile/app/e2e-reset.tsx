import { useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { resetConnectivityForE2E } from "@/lib/connectivity";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { resetLocalPreferencesForE2E } from "@/lib/local-preferences";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";

export default function E2EResetScreen() {
  const e2eEnabled = isE2EModeEnabled();
  const router = useRouter();
  const { logout } = useSession();

  useEffect(() => {
    if (!e2eEnabled) return;

    void (async () => {
      resetConnectivityForE2E();
      await Promise.all([logout(), resetLocalPreferencesForE2E()]);
      router.replace("/" as never);
    })();
  }, [e2eEnabled, logout, router]);

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
