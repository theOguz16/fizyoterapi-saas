import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getConnectivitySnapshot, subscribeConnectivity } from "@/lib/connectivity";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

export function ConnectivityBanner() {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState(getConnectivitySnapshot);
  const wasOfflineRef = useRef(false);

  useEffect(() => subscribeConnectivity(setSnapshot), []);

  useEffect(() => {
    if (snapshot.status === "offline") {
      wasOfflineRef.current = true;
      return;
    }

    if (snapshot.status === "online" && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      void queryClient.invalidateQueries();
    }
  }, [queryClient, snapshot.status, snapshot.lastChangedAt]);

  if (snapshot.status !== "offline") {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={styles.iconWrap}>
          <AppIcon name="risk" size="sm" tone="danger" />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.title}>Çevrimdışısın</Text>
          <Text style={styles.message}>{snapshot.message || "Son başarılı veriler gösteriliyor. Bağlantı gelince ekranlar otomatik yenilenecek."}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tekrar dene"
          onPress={() => void queryClient.invalidateQueries()}
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
    top: tokens.spacing.lg,
    zIndex: 100,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
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
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  copyWrap: {
    flex: 1,
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
