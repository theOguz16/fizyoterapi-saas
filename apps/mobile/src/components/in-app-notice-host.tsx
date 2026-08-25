import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/theme/components/app-icon";
import { subscribeToInAppNotices, type InAppNotice } from "@/lib/in-app-notice";
import { tokens } from "@/theme/tokens";

export function InAppNoticeHost() {
  const [notice, setNotice] = useState<InAppNotice | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => subscribeToInAppNotices(setNotice), []);

  useEffect(() => {
    if (!notice) return;

    opacity.setValue(0);
    translateY.setValue(-12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 160, useNativeDriver: true }),
      ]).start(() => setNotice((current) => current?.id === notice.id ? null : current));
    }, notice.durationMs);

    return () => clearTimeout(timer);
  }, [notice, opacity, translateY]);

  if (!notice) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        testID={notice.testID || "in-app-notice"}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.notice,
          notice.tone === "info" ? styles.noticeInfo : styles.noticeSuccess,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        <AppIcon name={notice.tone === "info" ? "notifications" : "checkin"} tone={notice.tone === "info" ? "primary" : "success"} size="sm" />
        <View style={styles.copy}>
          <Text testID="in-app-notice-title" style={styles.title}>{notice.title}</Text>
          <Text style={styles.message}>{notice.message}</Text>
        </View>
        <Pressable
          testID="in-app-notice-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Bildirimi kapat"
          hitSlop={8}
          onPress={() => setNotice(null)}
          style={({ pressed }) => [styles.dismiss, pressed ? styles.dismissPressed : null]}
        >
          <Text style={styles.dismissLabel}>×</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 54,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    zIndex: 1000,
    elevation: 20,
  },
  notice: {
    minHeight: 64,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    ...tokens.shadow.float,
  },
  noticeSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BCEEDC",
  },
  noticeInfo: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.borderStrong,
  },
  copy: {
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
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  dismiss: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissPressed: {
    backgroundColor: "rgba(31,41,55,0.08)",
  },
  dismissLabel: {
    color: tokens.colors.textMuted,
    fontSize: 24,
    lineHeight: 26,
    fontFamily: tokens.fontFamily.regular,
  },
});
