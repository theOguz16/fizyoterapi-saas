export function getVirtualListPanelHeight({
  itemCount,
  maxHeight,
  minHeight = 120,
  estimatedItemHeight = 150,
}: {
  itemCount: number;
  maxHeight: number;
  minHeight?: number;
  estimatedItemHeight?: number;
}) {
  return Math.min(maxHeight, Math.max(minHeight, itemCount * estimatedItemHeight));
}
