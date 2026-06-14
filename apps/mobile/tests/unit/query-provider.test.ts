import { describe, expect, it } from "vitest";
import { normalizeInvalidateTargets } from "@/lib/query-invalidation";
import { shouldPersistQueryKey } from "@/lib/query-cache-policy";

describe("query invalidation normalization", () => {
  it("keeps exact invalidation for plain query keys and supports prefix targets", () => {
    expect(
      normalizeInvalidateTargets([
        ["trainer-earnings"],
        { queryKey: ["admin-trainer-earnings"], exact: false },
      ])
    ).toEqual([
      { queryKey: ["trainer-earnings"], exact: true },
      { queryKey: ["admin-trainer-earnings"], exact: false },
    ]);
  });

  it("returns an empty list when mutation metadata is absent", () => {
    expect(normalizeInvalidateTargets(undefined)).toEqual([]);
  });

  it("persists only privacy-scoped operational query families", () => {
    expect(shouldPersistQueryKey(["member-home"])).toBe(true);
    expect(shouldPersistQueryKey(["admin-revenue-report", "2026-06-01"])).toBe(true);
    expect(shouldPersistQueryKey(["invite-preview", "secret-token"])).toBe(false);
    expect(shouldPersistQueryKey(["auth-session"])).toBe(false);
  });
});
