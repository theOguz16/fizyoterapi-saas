import { useCallback, useMemo, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getVirtualListPanelHeight } from "@/lib/virtual-list-panel";
import { tokens } from "../tokens";

type Props<T> = { data: T[]; renderItem: (item: T, index: number) => ReactElement<any, any>; keyExtractor: (item: T, index: number) => string; maxHeight?: number; minHeight?: number; testID?: string };

export function VirtualListPanel<T>({ data, renderItem, keyExtractor, maxHeight = 520, minHeight = 120, testID }: Props<T>) {
  const height = useMemo(
    () => getVirtualListPanelHeight({ itemCount: data.length, maxHeight, minHeight }),
    [data.length, maxHeight, minHeight]
  );
  const renderListItem = useCallback(({ item, index }: { item: T; index: number }) => renderItem(item, index), [renderItem]);

  return (
    <View style={[styles.wrap, { height }]} testID={testID}>
      <FlashList data={data} keyExtractor={keyExtractor} renderItem={renderListItem} ItemSeparatorComponent={ListSeparator} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" />
    </View>
  );
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({ wrap: { width: "100%" }, separator: { height: tokens.spacing.sm } });
