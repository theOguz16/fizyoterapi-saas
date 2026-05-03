import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { setPendingSalonJoinSlug } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";

export default function JoinSalonRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  useEffect(() => {
    const normalized = String(slug || "").trim().toLowerCase();
    if (!normalized) {
      router.replace("/(auth)/welcome" as never);
      return;
    }

    void (async () => {
      await setPendingSalonJoinSlug(normalized);
      router.replace(`/(intake-member)/salons/${normalized}` as never);
    })();
  }, [router, slug]);

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
