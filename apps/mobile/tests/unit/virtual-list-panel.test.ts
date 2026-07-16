import { describe, expect, it } from "vitest";
import { getVirtualListPanelHeight } from "@/lib/virtual-list-panel";

describe("virtual list panel height", () => {
  it("keeps a dense single-item card above its configured minimum height", () => {
    expect(getVirtualListPanelHeight({ itemCount: 1, maxHeight: 520, minHeight: 320 })).toBe(320);
  });

  it("uses the estimated content height without exceeding the maximum", () => {
    expect(getVirtualListPanelHeight({ itemCount: 2, maxHeight: 520 })).toBe(300);
    expect(getVirtualListPanelHeight({ itemCount: 10, maxHeight: 520, minHeight: 320 })).toBe(520);
  });
});
