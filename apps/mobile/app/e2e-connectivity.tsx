import { useEffect, useRef } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { markNetworkFailure, markNetworkSuccess } from "@/lib/connectivity";
import { tokens } from "@/theme/tokens";

/** Lets Maestro exercise the real app-wide banner without altering device networking. */
export default function E2EConnectivityScreen() {
  const e2eEnabled = isE2EModeEnabled();
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string | string[]; returnTo?: string | string[] }>();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!e2eEnabled || handledRef.current) return;
    handledRef.current = true;

    const status = Array.isArray(params.status) ? params.status[0] : params.status;
    const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
    if (status === "offline") {
      markNetworkFailure("Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.");
    } else {
      markNetworkSuccess();
    }
    router.replace((returnTo || "/(auth)/welcome") as never);
  }, [e2eEnabled, params.returnTo, params.status, router]);

  if (!e2eEnabled) return <Redirect href="/(auth)/welcome" />;

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={tokens.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.background },
});
