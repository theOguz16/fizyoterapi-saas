// Bu paylasilan UI component'i mobil tasarim sistemindeki section title parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { tokens } from "../tokens";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SectionTitle({ title, subtitle, action }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 390;

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={[styles.actionWrap, compact ? styles.actionWrapCompact : null]}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  wrapCompact: {
    flexDirection: "column",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  actionWrap: {
    alignSelf: "flex-start",
  },
  actionWrapCompact: {
    width: "100%",
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontWeight: "800",
    lineHeight: 22,
    fontFamily: tokens.fontFamily.semibold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
});
