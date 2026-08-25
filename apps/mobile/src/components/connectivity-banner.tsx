import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getConnectivitySnapshot, subscribeConnectivity } from "@/lib/connectivity";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";
import { shouldRefetchAfterReconnect } from "@/lib/query-performance";

export function ConnectivityBanner() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState(getConnectivitySnapshot);
  const [restoredVisible, setRestoredVisible] = useState(false);
  const handledReconnectRef = useRef<number | null>(null);

  useEffect(() => subscribeConnectivity(setSnapshot), []);

  useEffect(() => {
    if (
      snapshot.status === "online"
      && snapshot.reconnectedAt
      && handledReconnectRef.current !== snapshot.reconnectedAt
    ) {
      handledReconnectRef.current = snapshot.reconnectedAt;
      setRestoredVisible(true);
      void queryClient.refetchQueries({
        type: "active",
        predicate: shouldRefetchAfterReconnect,
      });
      const timer = setTimeout(() => setRestoredVisible(false), 8_000);
      return () => clearTimeout(timer);
    }
  }, [queryClient, snapshot.status, snapshot.reconnectedAt]);

  if (snapshot.status !== "offline" && !restoredVisible) {
    return null;
  }

  if (snapshot.status === "online" && restoredVisible) {
    return (
      <View
        testID="connectivity-restored-notice"
        style={[styles.wrap, { top: Math.max(insets.top + tokens.spacing.sm, tokens.spacing.lg) }]}
        pointerEvents="none"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.banner, styles.restoredBanner]}>
          <View style={[styles.iconWrap, styles.restoredIconWrap]}>
            <AppIcon name="checkin" size="sm" tone="success" />
          </View>
          <View style={styles.copyWrap}>
            <Text style={styles.title}>Bağlantı yeniden kuruldu</Text>
            <Text style={styles.message}>Ekrandaki bilgiler otomatik olarak yenileniyor.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="connectivity-banner"
      style={[styles.wrap, { top: Math.max(insets.top + tokens.spacing.sm, tokens.spacing.lg) }]}
      pointerEvents="box-none"
    >
      <View testID="offline-banner" style={styles.banner}>
        <View style={styles.iconWrap}>
          <AppIcon name="risk" size="sm" tone="danger" />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.title}>Çevrimdışısın</Text>
          <Text style={styles.message}>{snapshot.message || "Son başarılı veriler gösteriliyor. Bağlantı gelince ekranlar otomatik yenilenecek."}</Text>
        </View>
        <Pressable
          testID="connectivity-banner-retry"
          accessibilityRole="button"
          accessibilityLabel="Tekrar dene"
          onPress={() => void queryClient.refetchQueries({ type: "active" })}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>Tekrar dene</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    alignSelf: "center",
    maxWidth: 640,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  restoredBanner: {
    borderColor: tokens.colors.success,
    backgroundColor: "#F0FDF4",
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  restoredIconWrap: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  copyWrap: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  message: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  retry: {
    flexShrink: 0,
    minHeight: 34,
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: tokens.colors.danger,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    color: tokens.colors.surface,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
});
