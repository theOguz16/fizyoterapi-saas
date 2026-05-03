import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
}));

describe("selected city storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns empty string by default", async () => {
    const { getSelectedCity } = await import("@/lib/selected-city");

    await expect(getSelectedCity()).resolves.toBe("");
  });

  it("writes and reads the selected city", async () => {
    const { getSelectedCity, setSelectedCity } = await import("@/lib/selected-city");

    await setSelectedCity("Istanbul");

    await expect(getSelectedCity()).resolves.toBe("Istanbul");
  });
});
