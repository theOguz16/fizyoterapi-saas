import { describe, expect, it } from "vitest";
import { normalizeInvalidateTargets } from "@/providers/query-provider";

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
});
