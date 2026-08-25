import { describe, expect, it } from "vitest";
import { ACCESSIBLE_FONT_MULTIPLIER, contrastRatio, meetsWcagAA, resolveResponsiveLayout } from "@/lib/accessibility";
import { tokens } from "@/theme/tokens";

describe("mobile accessibility contracts", () => {
  it("keeps normal text and semantic colors at WCAG AA contrast", () => {
    expect(meetsWcagAA(tokens.colors.text, tokens.colors.surface)).toBe(true);
    expect(meetsWcagAA(tokens.colors.textMuted, tokens.colors.surface)).toBe(true);
    expect(meetsWcagAA(tokens.colors.primaryStrong, tokens.colors.surface)).toBe(true);
    expect(meetsWcagAA(tokens.colors.success, tokens.colors.successSoft)).toBe(true);
    expect(meetsWcagAA(tokens.colors.warning, tokens.colors.warningSoft)).toBe(true);
    expect(meetsWcagAA(tokens.colors.danger, "#FEE2E2")).toBe(true);
    expect(contrastRatio("#FFFFFF", tokens.colors.primaryStrong)).toBeGreaterThanOrEqual(4.5);
  });

  it("stacks multi-column content for small screens or large text", () => {
    expect(resolveResponsiveLayout(320, 1)).toMatchObject({ compactWidth: true, stackColumns: true, horizontalPadding: 12 });
    expect(resolveResponsiveLayout(430, 1.5)).toMatchObject({ largeText: true, stackColumns: true, metricMinWidth: 0 });
    expect(resolveResponsiveLayout(430, 1)).toMatchObject({ compactWidth: false, stackColumns: false, metricMinWidth: 150 });
  });

  it("allows meaningful dynamic type scaling", () => {
    expect(ACCESSIBLE_FONT_MULTIPLIER.body).toBeGreaterThanOrEqual(1.8);
    expect(ACCESSIBLE_FONT_MULTIPLIER.label).toBeGreaterThanOrEqual(1.8);
    expect(ACCESSIBLE_FONT_MULTIPLIER.action).toBeGreaterThanOrEqual(1.5);
    expect(ACCESSIBLE_FONT_MULTIPLIER.display).toBeGreaterThanOrEqual(1.4);
    expect(tokens.touch.min).toBeGreaterThanOrEqual(44);
  });
});
