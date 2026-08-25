import { describe, expect, it } from "vitest";
import { resolveScreenDataState } from "@/lib/screen-data-state";

const base = { isLoading: false, isFetching: false, isError: false, hasData: false, isEmpty: false, isOffline: false };

describe("screen data state", () => {
  it("distinguishes first load, empty, offline and terminal error", () => {
    expect(resolveScreenDataState({ ...base, isLoading: true })).toBe("initial-loading");
    expect(resolveScreenDataState({ ...base, isEmpty: true })).toBe("empty");
    expect(resolveScreenDataState({ ...base, isError: true, isOffline: true })).toBe("offline-empty");
    expect(resolveScreenDataState({ ...base, isError: true })).toBe("error-empty");
  });

  it("keeps cached content visible while refreshing or after an error", () => {
    expect(resolveScreenDataState({ ...base, hasData: true, isFetching: true })).toBe("refreshing");
    expect(resolveScreenDataState({ ...base, hasData: true, isError: true })).toBe("stale-error");
    expect(resolveScreenDataState({ ...base, hasData: true })).toBe("content");
  });
});
