import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { normalizeSalonSlug } from "@/lib/salon-qr";
import { setPendingSalonJoinIntent } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";

export default function JoinSalonRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[]; code?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  useEffect(() => {
    const normalized = normalizeSalonSlug(slug);
    if (!normalized) {
      router.replace("/(intake-member)" as never);
      return;
    }

    void setPendingSalonJoinIntent({ slug: normalized, source: "DEEPLINK", code }).then(() => {
      router.replace(`/(intake-member)/salons/${normalized}` as never);
    });
  }, [code, router, slug]);

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
