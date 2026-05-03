// Bu paylasilan UI component'i mobil tasarim sistemindeki scheduler board parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

export type SchedulerColumn = {
  key: string;
  label: string;
  slots: Array<{
    id: string;
    label: string;
    starts_at: string;
    ends_at: string;
  }>;
};

export type SchedulerItem = {
  id: string;
  title: string;
  subtitle: string;
  columnKey: string;
  slotId: string;
};

type Props = {
  columns: SchedulerColumn[];
  items: SchedulerItem[];
  onItemPress?: (item: SchedulerItem) => void;
  onItemDrop: (payload: { item: SchedulerItem; columnKey: string; slotId: string }) => void;
};

export function SchedulerBoard({ columns, items, onItemPress, onItemDrop }: Props) {
  const columnIndexMap = useMemo(
    () => new Map(columns.map((column, index) => [column.key, index])),
    [columns]
  );

  return (
    <View style={styles.board}>
      {columns.map((column) => (
        <View key={column.key} style={styles.column}>
          <Text style={styles.columnTitle}>{column.label}</Text>
          <View style={styles.slotStack}>
            {column.slots.map((slot, slotIndex) => {
              const slotItems = items.filter((item) => item.columnKey === column.key && item.slotId === slot.id);
              return (
                <View key={slot.id} style={styles.slot}>
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  {slotItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      columnIndex={columnIndexMap.get(column.key) ?? 0}
                      slotIndex={slotIndex}
                      columns={columns}
                      onPress={onItemPress}
                      onDrop={onItemDrop}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function DraggableItem({
  item,
  columnIndex,
  slotIndex,
  columns,
  onPress,
  onDrop,
}: {
  item: SchedulerItem;
  columnIndex: number;
  slotIndex: number;
  columns: SchedulerColumn[];
  onPress?: (item: SchedulerItem) => void;
  onDrop: (payload: { item: SchedulerItem; columnKey: string; slotId: string }) => void;
}) {
  const translate = useRef(new Animated.ValueXY()).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8,
        onPanResponderMove: Animated.event([null, { dx: translate.x, dy: translate.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gestureState) => {
          const columnDelta = gestureState.dx > 80 ? 1 : gestureState.dx < -80 ? -1 : 0;
          const slotDelta = gestureState.dy > 60 ? 1 : gestureState.dy < -60 ? -1 : 0;
          const nextColumnIndex = Math.min(columns.length - 1, Math.max(0, columnIndex + columnDelta));
          const targetColumn = columns[nextColumnIndex];
          const nextSlotIndex = Math.min(
            targetColumn.slots.length - 1,
            Math.max(0, slotIndex + slotDelta)
          );
          onDrop({
            item,
            columnKey: targetColumn.key,
            slotId: targetColumn.slots[nextSlotIndex]?.id ?? item.slotId,
          });
          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    [columnIndex, columns, item, onDrop, slotIndex, translate]
  );

  return (
    <Pressable onPress={() => onPress?.(item)}>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.item,
          {
            transform: translate.getTranslateTransform(),
          },
        ]}
      >
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        <Text style={styles.dragHint}>Surukle ve birak</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: tokens.spacing.md,
  },
  column: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  columnTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  slotStack: {
    gap: tokens.spacing.sm,
  },
  slot: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    gap: tokens.spacing.sm,
  },
  slotLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  item: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    padding: tokens.spacing.sm,
    gap: 4,
  },
  itemTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  itemSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  dragHint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
