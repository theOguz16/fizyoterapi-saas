import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "./action-button";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";

type Props = { mode: "loading" | "error"; title?: string; description?: string; icon?: AppIconName; onRetry?: () => void };

export function QueryState({ mode, title, description, icon = "risk", onRetry }: Props) {
  const loading = mode === "loading";
  return (
    <View style={styles.wrap} accessibilityRole={loading ? "progressbar" : "alert"} accessibilityLiveRegion="polite">
      {loading ? <ActivityIndicator color={tokens.colors.primary} /> : <AppIcon name={icon} size="lg" tone="danger" />}
      <Text style={styles.title}>{title || (loading ? "Veriler hazırlanıyor" : "Veriler alınamadı")}</Text>
      <Text style={styles.description}>{description || (loading ? "Son bilgiler yükleniyor." : "Bağlantını kontrol edip tekrar deneyebilirsin.")}</Text>
      {loading ? <View style={styles.skeletonWrap}><View style={[styles.skeleton, styles.skeletonWide]} /><View style={styles.skeleton} /><View style={[styles.skeleton, styles.skeletonShort]} /></View> : null}
      {!loading && onRetry ? <ActionButton label="Tekrar dene" icon="progress" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: tokens.spacing.sm, padding: tokens.spacing.xl, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, textAlign: "center", fontFamily: tokens.fontFamily.semibold },
  description: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, textAlign: "center", fontFamily: tokens.fontFamily.regular },
  skeletonWrap: { width: "100%", gap: tokens.spacing.xs, marginTop: tokens.spacing.sm },
  skeleton: { height: 12, width: "78%", alignSelf: "center", borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surfaceSoft },
  skeletonWide: { width: "92%" },
  skeletonShort: { width: "58%" },
});
