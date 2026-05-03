// Bu paylasilan UI component'i mobil tasarim sistemindeki progress stepper parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

type Props = {
  step: number;
  total: number;
  label?: string;
  showDots?: boolean;
};

export function ProgressStepper({ step, total, label, showDots = true }: Props) {
  const progress = total > 0 ? Math.min(1, Math.max(0, step / total)) : 0;
  const progressAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const width = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.caption}>{label || `Adım ${step}/${total}`}</Text>
        <Text style={styles.caption}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
      {showDots ? (
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, index) => {
            const active = index < step;
            const current = index === step - 1;
            return <AnimatedDot key={index} active={active} current={current} delay={index * 34} />;
          })}
        </View>
      ) : null}
    </View>
  );
}

function AnimatedDot({ active, current, delay }: { active: boolean; current: boolean; delay: number }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: current ? 1.06 : active ? 1 : 0.92,
      delay,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [active, current, delay, scale]);

  return <Animated.View style={[styles.dot, active ? styles.dotActive : null, current ? styles.dotCurrent : null, { transform: [{ scale }] }]} />;
}

const styles = StyleSheet.create({
  wrap: {
    gap: tokens.spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  caption: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  track: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.primary,
  },
  dots: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  dot: {
    flex: 1,
    height: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#D7E2EA",
  },
  dotActive: {
    backgroundColor: tokens.colors.primary,
  },
  dotCurrent: {
    backgroundColor: tokens.colors.primaryStrong,
  },
});
