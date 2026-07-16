import { describe, expect, it } from "vitest";
import { MOBILE_PERFORMANCE_BUDGETS, PUSH_RELEASE_SCENARIOS, RELEASE_CRITICAL_MOBILE_FLOWS } from "@/lib/release-gate";

describe("mobile release gate contract", () => {
  it("covers each role and every critical operational flow", () => {
    expect(new Set(RELEASE_CRITICAL_MOBILE_FLOWS.map((flow) => flow.role))).toEqual(
      new Set(["ADMIN", "TRAINER", "MEMBER", "ALL"]),
    );
    expect(new Set(RELEASE_CRITICAL_MOBILE_FLOWS.map((flow) => flow.kind))).toEqual(
      new Set(["login", "join", "package", "booking", "checkin", "role-switch", "push"]),
    );
    expect(RELEASE_CRITICAL_MOBILE_FLOWS.filter((flow) => flow.mode === "automated").every((flow) => Boolean(flow.flow))).toBe(true);
  });

  it("keeps mobile performance budgets within release-grade limits", () => {
    expect(MOBILE_PERFORMANCE_BUDGETS.coldStartMs).toBeLessThanOrEqual(3000);
    expect(MOBILE_PERFORMANCE_BUDGETS.warmStartMs).toBeLessThanOrEqual(1500);
    expect(MOBILE_PERFORMANCE_BUDGETS.listScrollFps).toBeGreaterThanOrEqual(55);
    expect(MOBILE_PERFORMANCE_BUDGETS.droppedFramePercent).toBeLessThanOrEqual(5);
  });

  it("requires foreground, background and terminated push proof for every role", () => {
    expect(PUSH_RELEASE_SCENARIOS).toHaveLength(9);
    for (const role of ["ADMIN", "TRAINER", "MEMBER"]) {
      expect(PUSH_RELEASE_SCENARIOS.filter((scenario) => scenario.role === role).map((scenario) => scenario.appState)).toEqual([
        "foreground",
        "background",
        "terminated",
      ]);
    }
  });
});
