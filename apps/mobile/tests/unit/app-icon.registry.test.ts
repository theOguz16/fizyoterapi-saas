import { describe, expect, it } from "vitest";
import { APP_ICON_NAMES } from "@/theme/components/app-icon.names";

describe("mobile icon registry", () => {
  it("keeps expected critical icons registered", () => {
    expect(APP_ICON_NAMES).toEqual(expect.arrayContaining(["home", "calendar", "trainer", "member", "spark", "logout"]));
  });

  it("keeps icon names unique", () => {
    expect(new Set(APP_ICON_NAMES).size).toBe(APP_ICON_NAMES.length);
  });
});
