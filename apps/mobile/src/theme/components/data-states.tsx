import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { normalizeApiError } from "@/lib/api-error";
import { getConnectivitySnapshot } from "@/lib/connectivity";
import { ActionButton } from "./action-button";
import { AppIcon } from "./app-icon";
import { tokens } from "../tokens";

type SkeletonVariant = "list" | "card" | "detail";

export function ContentSkeleton({ variant = "list", rows }: { variant?: SkeletonVariant; rows?: number }) {
  const count = rows ?? (variant === "detail" ? 5 : 3);
  return (
    <View testID={`${variant}-skeleton`} accessibilityElementsHidden style={styles.skeletonGroup}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.skeleton,
            variant === "card" ? styles.cardSkeleton : null,
            variant === "detail" && index === 0 ? styles.detailHero : null,
            index === count - 1 ? styles.skeletonShort : null,
          ]}
        />
      ))}
    </View>
  );
}

export function ScreenLoading({ title = "Veriler hazırlanıyor", variant = "list" }: { title?: string; variant?: SkeletonVariant }) {
  return (
    <View testID="screen-loading" style={styles.stateCard} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
      <ActivityIndicator color={tokens.colors.primary} />
      <Text maxFontSizeMultiplier={1.8} style={styles.title}>{title}</Text>
      <Text maxFontSizeMultiplier={2} style={styles.description}>Son bilgiler yükleniyor.</Text>
      <ContentSkeleton variant={variant} />
    </View>
  );
}

export function InlineLoading({ label = "Güncelleniyor" }: { label?: string }) {
  return (
    <View testID="inline-loading" style={styles.inline} accessibilityRole="progressbar">
      <ActivityIndicator size="small" color={tokens.colors.primary} />
      <Text maxFontSizeMultiplier={2} style={styles.inlineText}>{label}</Text>
    </View>
  );
}

export function ActionLoading({ label = "İşlem sürüyor" }: { label?: string }) {
  return <InlineLoading label={label} />;
}

export function ScreenErrorState({
  error,
  title,
  description,
  onRetry,
}: {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const normalized = normalizeApiError(error);
  const offline = normalized.kind === "offline" || getConnectivitySnapshot().status === "offline";

  if (offline) {
    return <OfflineState description={description} onRetry={onRetry} />;
  }

  return (
    <View testID="screen-error-state" style={styles.stateCard} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppIcon name="risk" size="lg" tone="danger" />
      <Text maxFontSizeMultiplier={1.8} style={styles.title}>{title || normalized.title}</Text>
      <Text maxFontSizeMultiplier={2} style={styles.description}>{description || normalized.message}</Text>
      {onRetry && normalized.retryable ? (
        <ActionButton testID="screen-error-retry" label="Tekrar dene" icon="progress" variant="ghost" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function InlineErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const normalized = normalizeApiError(error);
  return (
    <View testID="inline-error-state" style={styles.inlineError} accessibilityRole="alert">
      <AppIcon name="risk" size="sm" tone="danger" />
      <Text maxFontSizeMultiplier={2} style={styles.inlineErrorText}>{normalized.message}</Text>
      {onRetry && normalized.retryable ? (
        <ActionButton testID="inline-error-retry" label="Yenile" variant="ghost" fullWidth={false} onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function OfflineState({ description, onRetry }: { description?: string; onRetry?: () => void }) {
  return (
    <View testID="offline-empty-state" style={styles.stateCard} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppIcon name="risk" size="lg" tone="danger" />
      <Text maxFontSizeMultiplier={1.8} style={styles.title}>İnternet bağlantısı yok</Text>
      <Text maxFontSizeMultiplier={2} style={styles.description}>{description || "Bu ekran için kayıtlı veri bulunamadı. Bağlantın geldiğinde tekrar deneyebilirsin."}</Text>
      {onRetry ? <ActionButton testID="offline-retry" label="Tekrar dene" icon="progress" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
  },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, textAlign: "center", fontFamily: tokens.fontFamily.semibold },
  description: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, textAlign: "center", fontFamily: tokens.fontFamily.regular },
  skeletonGroup: { width: "100%", gap: tokens.spacing.xs, marginTop: tokens.spacing.sm },
  skeleton: { height: 12, width: "92%", alignSelf: "center", borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.surfaceSoft },
  skeletonShort: { width: "58%" },
  cardSkeleton: { height: 44, borderRadius: tokens.radius.md },
  detailHero: { height: 72, borderRadius: tokens.radius.md },
  inline: { flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs, paddingVertical: tokens.spacing.xs },
  inlineText: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.regular },
  inlineError: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: tokens.spacing.sm, padding: tokens.spacing.sm, borderRadius: tokens.radius.md, backgroundColor: "rgba(239, 68, 68, 0.08)" },
  inlineErrorText: { flex: 1, minWidth: 160, color: tokens.colors.text, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.regular },
});
