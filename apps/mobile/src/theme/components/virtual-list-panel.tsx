import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getVirtualListPanelHeight } from "@/lib/virtual-list-panel";
import { tokens } from "../tokens";

type Props<T> = { data: T[]; renderItem: (item: T, index: number) => ReactElement<any, any>; keyExtractor: (item: T, index: number) => string; maxHeight?: number; minHeight?: number; testID?: string };

export function VirtualListPanel<T>({ data, renderItem, keyExtractor, maxHeight = 520, minHeight = 120, testID }: Props<T>) {
  return (
    <View style={[styles.wrap, { height: getVirtualListPanelHeight({ itemCount: data.length, maxHeight, minHeight }) }]} testID={testID}>
      <FlashList data={data} keyExtractor={keyExtractor} renderItem={({ item, index }) => renderItem(item, index)} ItemSeparatorComponent={() => <View style={styles.separator} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { width: "100%" }, separator: { height: tokens.spacing.sm } });
