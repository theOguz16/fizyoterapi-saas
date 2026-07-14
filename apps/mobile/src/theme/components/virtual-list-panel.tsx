import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { tokens } from "../tokens";

type Props<T> = { data: T[]; renderItem: (item: T, index: number) => ReactElement<any, any>; keyExtractor: (item: T, index: number) => string; maxHeight?: number; testID?: string };

export function VirtualListPanel<T>({ data, renderItem, keyExtractor, maxHeight = 520, testID }: Props<T>) {
  return (
    <View style={[styles.wrap, { height: Math.min(maxHeight, Math.max(120, data.length * 150)) }]} testID={testID}>
      <FlashList data={data} keyExtractor={keyExtractor} renderItem={({ item, index }) => renderItem(item, index)} ItemSeparatorComponent={() => <View style={styles.separator} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { width: "100%" }, separator: { height: tokens.spacing.sm } });
