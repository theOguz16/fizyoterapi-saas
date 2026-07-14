import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

describe("notification preferences storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns defaults when nothing is stored", async () => {
    const { getNotificationPreferences } = await import("@/lib/local-preferences");

    await expect(getNotificationPreferences()).resolves.toEqual({
      classReminderThreeHours: true,
      classReminderOneHour: true,
      subscriptionTrialFortyEightHours: true,
      subscriptionTrialTwentyFourHours: true,
      subscriptionTrialTwelveHours: true,
      subscriptionTrialFourHours: true,
      campaignAlerts: true,
      weeklySummary: true,
      packageEndingAlerts: true,
      measurementReminders: true,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
    });
  });

  it("persists and reads notification preferences", async () => {
    const { getNotificationPreferences, setNotificationPreferences } = await import("@/lib/local-preferences");

    await setNotificationPreferences({
      classReminderThreeHours: false,
      classReminderOneHour: true,
      subscriptionTrialFortyEightHours: true,
      subscriptionTrialTwentyFourHours: false,
      subscriptionTrialTwelveHours: true,
      subscriptionTrialFourHours: false,
      campaignAlerts: true,
      weeklySummary: false,
      packageEndingAlerts: true,
      measurementReminders: false,
      quietHoursEnabled: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
    });

    await expect(getNotificationPreferences()).resolves.toEqual({
      classReminderThreeHours: false,
      classReminderOneHour: true,
      subscriptionTrialFortyEightHours: true,
      subscriptionTrialTwentyFourHours: false,
      subscriptionTrialTwelveHours: true,
      subscriptionTrialFourHours: false,
      campaignAlerts: true,
      weeklySummary: false,
      packageEndingAlerts: true,
      measurementReminders: false,
      quietHoursEnabled: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
    });
  });

  it("returns default notification prompt state when nothing is stored", async () => {
    const { getNotificationPermissionPromptState } = await import("@/lib/local-preferences");

    await expect(getNotificationPermissionPromptState()).resolves.toEqual({
      hasSeenPrompt: false,
      lastKnownStatus: "undetermined",
      updatedAt: null,
    });
  });

  it("persists and reads notification prompt state", async () => {
    const { getNotificationPermissionPromptState, setNotificationPermissionPromptState } = await import("@/lib/local-preferences");

    await setNotificationPermissionPromptState({
      hasSeenPrompt: true,
      lastKnownStatus: "granted",
      updatedAt: "2025-01-01T10:00:00.000Z",
    });

    await expect(getNotificationPermissionPromptState()).resolves.toEqual({
      hasSeenPrompt: true,
      lastKnownStatus: "granted",
      updatedAt: "2025-01-01T10:00:00.000Z",
    });
  });

  it("returns false for signup onboarding completion when nothing is stored", async () => {
    const { hasCompletedSignupOnboarding } = await import("@/lib/local-preferences");

    await expect(hasCompletedSignupOnboarding()).resolves.toBe(false);
  });

  it("persists signup onboarding completion flag", async () => {
    const { hasCompletedSignupOnboarding, setSignupOnboardingCompleted } = await import("@/lib/local-preferences");

    await setSignupOnboardingCompleted(true);
    await expect(hasCompletedSignupOnboarding()).resolves.toBe(true);
  });

  it("persists signup onboarding profile by role", async () => {
    const { getStoredSignupOnboardingProfile, setStoredSignupOnboardingProfile } = await import("@/lib/local-preferences");

    await setStoredSignupOnboardingProfile("MEMBER", {
      primaryGoal: "fitness",
      rhythm: "steady",
      supportStyle: "guided",
    });

    await expect(getStoredSignupOnboardingProfile("MEMBER")).resolves.toEqual({
      primaryGoal: "fitness",
      rhythm: "steady",
      supportStyle: "guided",
    });
  });

  it("persists a sourced salon intent for 24-hour onboarding continuation", async () => {
    const { getPendingSalonJoinIntent, getPendingSalonJoinSlug, setPendingSalonJoinSlug, clearPendingSalonJoinSlug } = await import("@/lib/local-preferences");
    const now = new Date("2026-07-14T08:00:00.000Z");

    await setPendingSalonJoinSlug("Demo-Salon", "QR", now);
    await expect(getPendingSalonJoinSlug(new Date("2026-07-15T07:59:59.000Z"))).resolves.toBe("demo-salon");
    await expect(getPendingSalonJoinIntent(new Date("2026-07-15T07:59:59.000Z"))).resolves.toEqual({
      slug: "demo-salon",
      source: "QR",
      createdAt: "2026-07-14T08:00:00.000Z",
      expiresAt: "2026-07-15T08:00:00.000Z",
    });

    await clearPendingSalonJoinSlug();
    await expect(getPendingSalonJoinSlug()).resolves.toBeNull();
  });

  it("expires stale salon intents and replaces them when another clinic is selected", async () => {
    const { getPendingSalonJoinIntent, setPendingSalonJoinSlug } = await import("@/lib/local-preferences");

    await setPendingSalonJoinSlug("first-clinic", "DEEPLINK", new Date("2026-07-14T08:00:00.000Z"));
    await setPendingSalonJoinSlug("second-clinic", "DISCOVERY", new Date("2026-07-14T09:00:00.000Z"));
    await expect(getPendingSalonJoinIntent(new Date("2026-07-15T08:59:59.000Z"))).resolves.toEqual(
      expect.objectContaining({ slug: "second-clinic", source: "DISCOVERY" })
    );
    await expect(getPendingSalonJoinIntent(new Date("2026-07-15T09:00:00.000Z"))).resolves.toBeNull();
  });

  it("does not revive legacy slug-only salon selections", async () => {
    const { getPendingSalonJoinIntent } = await import("@/lib/local-preferences");
    store.set("fizyoflow.pending_salon_join_slug.v1", "month-old-clinic");

    await expect(getPendingSalonJoinIntent()).resolves.toBeNull();
    expect(store.has("fizyoflow.pending_salon_join_slug.v1")).toBe(false);
  });
});
