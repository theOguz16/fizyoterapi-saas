// Router eslesmeyen bir path aldiginda bu fallback ekran gosterilir.
// Hatali veya eski linklerden gelen kullaniciyi uygulama icinde guvenli sekilde tutmak icin vardir.
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sayfa bulunamadı</Text>
      <Link href="/" style={styles.link}>
        Ana sayfaya dön
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
    gap: 12,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontWeight: "700",
  },
  link: {
    color: tokens.colors.primary,
    fontSize: tokens.font.sm,
    fontWeight: "600",
  },
});
