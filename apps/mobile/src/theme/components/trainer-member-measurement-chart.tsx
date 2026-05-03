import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { tokens } from "../tokens";

export type TrainerMeasurementPoint = {
  label: string;
  height_cm: number | null;
  weight_kg: number | null;
  fat_percent: number | null;
  muscle_kg: number | null;
};

type MetricKey = "height_cm" | "weight_kg" | "fat_percent" | "muscle_kg";

const SERIES: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "height_cm", label: "Boy", color: "#64748B" },
  { key: "weight_kg", label: "Kilo", color: "#0F766E" },
  { key: "fat_percent", label: "Yağ %", color: "#F97316" },
  { key: "muscle_kg", label: "Kas", color: "#2563EB" },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function formatSeriesValue(key: MetricKey, value: number | null) {
  if (value === null) return "-";
  const text = value % 1 === 0 ? String(value) : value.toFixed(1);
  if (key === "height_cm") return `${text} cm`;
  if (key === "fat_percent") return `%${text}`;
  return `${text} kg`;
}

function buildInsightText(key: MetricKey, diff: number) {
  const amount = Math.abs(diff);
  const text = amount % 1 === 0 ? String(amount) : amount.toFixed(1);

  if (key === "weight_kg") {
    return diff === 0 ? "Kilo sabit kaldı" : `Kilo ${diff > 0 ? `${text} kg arttı` : `${text} kg azaldı`}`;
  }
  if (key === "fat_percent") {
    return diff === 0 ? "Yağ oranı sabit kaldı" : `Yağ oranı ${diff > 0 ? `%${text} arttı` : `%${text} azaldı`}`;
  }
  if (key === "muscle_kg") {
    return diff === 0 ? "Kas kütlesi sabit kaldı" : `Kas kütlesi ${diff > 0 ? `${text} kg arttı` : `${text} kg azaldı`}`;
  }
  return diff === 0 ? "Boy sabit kaldı" : `Boy ${diff > 0 ? `${text} cm arttı` : `${text} cm azaldı`}`;
}

function buildSparklinePoints(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  if (values.length === 1) return `${width / 2},${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (width * index) / (values.length - 1);
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function ActivePulseRing({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.out(Easing.ease),
      }),
      -1,
      false
    );
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    r: 6 + progress.value * 7,
    opacity: 0.35 - progress.value * 0.35,
  }));

  return <AnimatedCircle animatedProps={animatedProps} cx={cx} cy={cy} fill="none" stroke={color} strokeWidth={2} />;
}

export function TrainerMemberMeasurementChart({ points }: { points: TrainerMeasurementPoint[] }) {
  const [activeIndex, setActiveIndex] = useState(points.length > 0 ? points.length - 1 : 0);
  const [visibleKeys, setVisibleKeys] = useState<MetricKey[]>(SERIES.map((series) => series.key));

  useEffect(() => {
    setActiveIndex(points.length > 0 ? points.length - 1 : 0);
  }, [points]);

  const chart = useMemo(() => {
    const width = Math.max(320, points.length * 64);
    const height = 220;
    const padding = { top: 20, right: 14, bottom: 34, left: 14 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const allValues = points.flatMap((point) =>
      SERIES.map((series) => point[series.key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    );

    if (allValues.length === 0 || points.length === 0) return null;

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    const yMin = minValue - range * 0.08;
    const yMax = maxValue + range * 0.08;
    const safeRange = yMax - yMin || 1;

    const xAt = (index: number) => {
      if (points.length === 1) return padding.left + innerWidth / 2;
      return padding.left + (innerWidth * index) / (points.length - 1);
    };

    const yAt = (value: number) => padding.top + innerHeight - ((value - yMin) / safeRange) * innerHeight;

    const labelStep = points.length > 10 ? Math.ceil(points.length / 5) : 1;

    return {
      width,
      height,
      padding,
      innerWidth,
      gridLines: Array.from({ length: 4 }, (_, index) => padding.top + (innerHeight * index) / 3),
      labels: points.map((point, index) => ({ x: xAt(index), label: point.label, hidden: index % labelStep !== 0 && index !== points.length - 1 })),
      hitAreas: points.map((_, index) => {
        const x = xAt(index);
        const previous = index === 0 ? padding.left : xAt(index - 1);
        const next = index === points.length - 1 ? padding.left + innerWidth : xAt(index + 1);
        return {
          index,
          x: (previous + x) / 2,
          width: Math.max((next - previous) / 2, 24),
        };
      }),
      paths: SERIES.map((series) => {
        const values = points
          .map((point, index) => {
            const raw = point[series.key];
            if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
            return { x: xAt(index), y: yAt(raw), index };
          })
          .filter((item): item is { x: number; y: number; index: number } => Boolean(item));

        return {
          ...series,
          values,
          polyline: values.map((item) => `${item.x},${item.y}`).join(" "),
        };
      }),
    };
  }, [points]);

  if (!chart) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Grafik hazır değil</Text>
        <Text style={styles.emptyCopy}>Anlamlı bir trend gösterebilmek için en az iki ölçüm kaydı gerekiyor. Yeni kayıtlar geldikçe grafik otomatik dolacak.</Text>
      </View>
    );
  }

  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(points.length - 1, 0));
  const visibleSeries = SERIES.filter((series) => visibleKeys.includes(series.key));
  const activePoint = points[safeActiveIndex] || null;
  const activeColumns = visibleSeries.map((series) => ({
    ...series,
    value: activePoint?.[series.key] ?? null,
    point: chart.paths.find((path) => path.key === series.key)?.values.find((item) => item.index === safeActiveIndex) || null,
  }));
  const focusX = activeColumns.find((series) => series.point)?.point?.x ?? null;
  const trendInsights = visibleSeries
    .map((series) => {
      const recent = [...points]
        .map((point) => point[series.key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .slice(-2);

      if (recent.length < 2) return null;

      const diff = recent[1] - recent[0];
      const isUp = diff > 0;
      
      // RENK MANTIĞI BURADA KURULUYOR:
      // Kas artışı İYİDİR (Yeşil), Kas azalışı KÖTÜDÜR (Kırmızı)
      // Kilo/Yağ artışı KÖTÜDÜR (Kırmızı), Kilo/Yağ azalışı İYİDİR (Yeşil)
      let toneStyle;
      if (series.key === "muscle_kg" || series.key === "height_cm") {
         toneStyle = isUp ? styles.insightSuccess : styles.insightDanger;
      } else if (series.key === "weight_kg" || series.key === "fat_percent") {
         toneStyle = isUp ? styles.insightDanger : styles.insightSuccess;
      } 

      return {
        key: series.key,
        label: series.label,
        color: series.color,
        text: buildInsightText(series.key, diff),
        tone: diff === 0 ? styles.insightNeutral : toneStyle,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const recentThirtyPoints = points.slice(-Math.min(points.length, 30));
  const recentThirtyInsights = visibleSeries
    .map((series) => {
      const values = recentThirtyPoints
        .map((point) => point[series.key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      if (values.length < 2) return null;

      const first = values[0];
      const last = values[values.length - 1];
      const diff = last - first;
      return {
        key: series.key,
        color: series.color,
        label: series.label,
        text: buildInsightText(series.key, diff),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sparklineCards = visibleSeries
    .map((series) => {
      const values = points
        .map((point) => point[series.key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      if (values.length < 2) return null;

      const latest = values[values.length - 1];
      const previous = values[values.length - 2];
      const diff = latest - previous;

      return {
        key: series.key,
        label: series.label,
        color: series.color,
        latest: formatSeriesValue(series.key, latest),
        diff,
        points: buildSparklinePoints(values.slice(-12), 92, 28),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  function toggleMetric(key: MetricKey) {
    setVisibleKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        {SERIES.map((series) => {
          const active = visibleKeys.includes(series.key);
          return (
            <Pressable
              key={series.key}
              onPress={() => toggleMetric(series.key)}
              style={[styles.filterChip, active ? { borderColor: series.color, backgroundColor: `${series.color}14` } : null]}
            >
              <View style={[styles.legendDot, { backgroundColor: series.color, opacity: active ? 1 : 0.4 }]} />
              <Text style={[styles.filterLabel, !active ? styles.filterLabelMuted : null]}>{series.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activePoint ? (
        <View style={styles.tooltipCard}>
          <Text style={styles.tooltipTitle}>{activePoint.label}</Text>
          <View style={styles.tooltipGrid}>
            {activeColumns.map((series) => (
              <View key={series.key} style={styles.tooltipItem}>
                <View style={[styles.legendDot, { backgroundColor: series.color }]} />
                <View style={styles.tooltipCopy}>
                  <Text style={styles.tooltipLabel}>{series.label}</Text>
                  <Text style={styles.tooltipValue}>{formatSeriesValue(series.key, series.value)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
        <Svg width={chart.width} viewBox={`0 0 ${chart.width} ${chart.height}`} style={styles.chart}>
          {chart.gridLines.map((y) => (
            <Line key={y} x1="14" x2={chart.width - 14} y1={y} y2={y} stroke="#E5EDF5" strokeDasharray="4 4" />
          ))}

          {chart.hitAreas.map((area) => (
            <Rect
              key={`hit-${area.index}`}
              x={area.x - area.width / 2}
              y={chart.padding.top}
              width={area.width}
              height={156}
              fill="transparent"
              onPress={() => setActiveIndex(area.index)}
            />
          ))}

          {visibleSeries.map((series) => {
            const path = chart.paths.find((item) => item.key === series.key);
            if (!path || path.values.length <= 1) return null;
            return (
              <Polyline
                key={series.key}
                points={path.polyline}
                fill="none"
                stroke={series.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {focusX ? (
            <Line
              x1={focusX}
              x2={focusX}
              y1={chart.padding.top}
              y2={chart.height - chart.padding.bottom}
              stroke="rgba(148,163,184,0.22)"
              strokeDasharray="3 5"
            />
          ) : null}

          {activeColumns.map((series) =>
            series.point ? <ActivePulseRing key={`pulse-${series.key}`} cx={series.point.x} cy={series.point.y} color={series.color} /> : null
          )}

          {visibleSeries.flatMap((series) => {
            const path = chart.paths.find((item) => item.key === series.key);
            if (!path) return [];
            return path.values.map((point, index) => (
              <Circle
                key={`${series.key}-${index}`}
                cx={point.x}
                cy={point.y}
                r={point.index === safeActiveIndex ? "5.5" : "3.5"}
                fill={series.color}
                stroke={point.index === safeActiveIndex ? "#FFFFFF" : "none"}
                strokeWidth={point.index === safeActiveIndex ? "2" : "0"}
              />
            ));
          })}

          {chart.labels.map((label, index) =>
            label.hidden ? null : (
              <SvgText key={`${label.label}-${index}`} x={label.x} y="208" fontSize="11" fill={tokens.colors.textMuted} textAnchor="middle">
                {label.label}
              </SvgText>
            )
          )}
        </Svg>
      </ScrollView>

      <View style={styles.legend}>
        {visibleSeries.map((series) => (
          <View key={series.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: series.color }]} />
            <Text style={styles.legendLabel}>{series.label}</Text>
          </View>
        ))}
      </View>

      {trendInsights.length > 0 ? (
        <View style={styles.insightWrap}>
          <Text style={styles.insightTitle}>Değişim özeti</Text>
          {trendInsights.map((insight) => (
            <View key={insight.key} style={[styles.insightCard, insight.tone]}>
              <View style={[styles.legendDot, { backgroundColor: insight.color }]} />
              <Text style={styles.insightArrow}>
                {insight.text.includes("arttı") ? "↑" : insight.text.includes("azaldı") ? "↓" : "→"}
              </Text>
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recentThirtyInsights.length > 0 ? (
        <View style={styles.monthWrap}>
          <Text style={styles.insightTitle}>Son 30 gün özeti</Text>
          {recentThirtyInsights.map((insight) => (
            <View key={`month-${insight.key}`} style={styles.monthCard}>
              <View style={[styles.legendDot, { backgroundColor: insight.color }]} />
              <Text style={styles.monthText}>{insight.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {sparklineCards.length > 0 ? (
        <View style={styles.sparkWrap}>
          <Text style={styles.insightTitle}>Mini trend kartları</Text>
          <View style={styles.sparkGrid}>
            {sparklineCards.map((card) => (
              <View key={`spark-${card.key}`} style={styles.sparkCard}>
                <View style={styles.sparkHeader}>
                  <Text style={styles.sparkLabel}>{card.label}</Text>
                  <Text style={[styles.sparkDelta, card.diff > 0 ? styles.sparkDeltaUp : card.diff < 0 ? styles.sparkDeltaDown : styles.sparkDeltaNeutral]}>
                    {card.diff > 0 ? "↑" : card.diff < 0 ? "↓" : "→"}
                  </Text>
                </View>
                <Text style={styles.sparkValue}>{card.latest}</Text>
                <Svg width="92" height="28" viewBox="0 0 92 28">
                  <Polyline points={card.points} fill="none" stroke={card.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                </Svg>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: tokens.spacing.md,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
  },
  filterLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  filterLabelMuted: {
    color: tokens.colors.textMuted,
  },
  tooltipCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  tooltipTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  tooltipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  tooltipItem: {
    flexGrow: 1,
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.md,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: tokens.spacing.sm,
  },
  tooltipCopy: {
    gap: 2,
  },
  tooltipLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  tooltipValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  chart: {
    height: 220,
  },
  chartScrollContent: {
    paddingRight: tokens.spacing.sm,
  },
  insightWrap: {
    gap: tokens.spacing.sm,
  },
  insightTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: tokens.spacing.sm,
  },
  insightText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  insightArrow: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  insightSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  insightWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  insightDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  insightNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  monthWrap: {
    gap: tokens.spacing.sm,
  },
  monthCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: tokens.spacing.sm,
  },
  monthText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  sparkWrap: {
    gap: tokens.spacing.sm,
  },
  sparkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sparkCard: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.sm + 2,
    gap: tokens.spacing.xs + 2,
  },
  sparkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  sparkLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  sparkValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  sparkDelta: {
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  sparkDeltaUp: {
    color: tokens.colors.success,
  },
  sparkDeltaDown: {
    color: tokens.colors.warning,
  },
  sparkDeltaNeutral: {
    color: tokens.colors.textMuted,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#F6F8FA",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  emptyState: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
  },
  emptyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  emptyCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
