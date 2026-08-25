// Bu paylasilan UI component'i mobil tasarim sistemindeki detail sheet parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { ConnectivityBanner } from "@/components/connectivity-banner";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentTestID?: string;
  scrollEnabled?: boolean;
};

export function DetailSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  contentTestID,
  scrollEnabled = true,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, footer ? styles.sheetWithFooter : null]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeChip, pressed ? styles.closeChipPressed : null]}>
                <Text style={styles.closeChipLabel}>Kapat</Text>
              </Pressable>
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {scrollEnabled ? (
            <ScrollView
              testID={contentTestID}
              style={styles.content}
              contentContainerStyle={[styles.contentInner, footer ? styles.contentInnerWithFooter : null]}
              showsVerticalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              contentInsetAdjustmentBehavior="automatic"
            >
              {children}
            </ScrollView>
          ) : (
            <View testID={contentTestID} style={[styles.content, styles.contentInner, footer ? styles.contentInnerWithFooter : null]}>
              {children}
            </View>
          )}
          {footer}
        </View>
      </View>
      <ConnectivityBanner />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: tokens.colors.overlay,
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  sheetWithFooter: {
    paddingBottom: 0,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: tokens.colors.borderStrong,
    opacity: 0.65,
  },
  header: {
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
    flex: 1,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  closeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  closeChipPressed: {
    opacity: 0.8,
  },
  closeChipLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
  },
  contentInner: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xs,
  },
  contentInnerWithFooter: {
    paddingBottom: tokens.spacing.sm,
  },
});
