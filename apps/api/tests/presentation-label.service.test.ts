import { describe, expect, it } from "vitest";
import { lessonCategoryLabel, packageDisplayName } from "../services/presentation-label.service";

describe("presentation label service", () => {
  it("maps lesson categories to readable labels", () => {
    expect(lessonCategoryLabel("GRUP")).toBe("Grup");
    expect(lessonCategoryLabel("GROUP")).toBe("Grup");
    expect(lessonCategoryLabel("SCOLIOSIS")).toBe("Skolyoz");
    expect(lessonCategoryLabel("REFORMER")).toBe("Reformer");
    expect(lessonCategoryLabel("")).toBeNull();
  });

  it("normalizes package display names", () => {
    expect(packageDisplayName("  8'li Grup Paketi ")).toBe("8'li Grup Paketi");
    expect(packageDisplayName("")).toBeNull();
  });
});
