export const ACCESSIBLE_FONT_MULTIPLIER = {
  display: 1.4,
  action: 1.6,
  body: 2,
  label: 1.8,
} as const;

export function resolveResponsiveLayout(width: number, fontScale = 1) {
  const compactWidth = width < 390;
  const largeText = fontScale >= 1.3;
  return {
    compactWidth,
    largeText,
    stackColumns: width < 370 || largeText,
    horizontalPadding: width < 360 ? 12 : compactWidth ? 16 : 20,
    metricMinWidth: width < 390 || largeText ? 0 : 150,
  };
}

export function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAA(foreground: string, background: string, largeText = false) {
  return contrastRatio(foreground, background) >= (largeText ? 3 : 4.5);
}

function relativeLuminance(color: string) {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Geçersiz renk: ${color}`);
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
