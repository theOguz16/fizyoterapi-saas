import { describe, expect, it } from "vitest";
import { QUERY_TIMING, shouldRefetchAfterReconnect } from "@/lib/query-performance";

describe("mobile query performance policy", () => {
  it("refetches only active stale queries after reconnect", () => {
    expect(shouldRefetchAfterReconnect({ isActive: () => true, isStale: () => true })).toBe(true);
    expect(shouldRefetchAfterReconnect({ isActive: () => true, isStale: () => false })).toBe(false);
    expect(shouldRefetchAfterReconnect({ isActive: () => false, isStale: () => true })).toBe(false);
  });

  it("keeps live data fresher than home, list and reference data", () => {
    expect(QUERY_TIMING.live).toBeLessThan(QUERY_TIMING.home);
    expect(QUERY_TIMING.home).toBeLessThan(QUERY_TIMING.list);
    expect(QUERY_TIMING.list).toBeLessThan(QUERY_TIMING.reference);
  });
});
