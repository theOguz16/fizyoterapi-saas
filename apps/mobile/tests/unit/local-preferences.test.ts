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

  it("persists pending salon slug for qr onboarding continuation", async () => {
    const { getPendingSalonJoinSlug, setPendingSalonJoinSlug, clearPendingSalonJoinSlug } = await import("@/lib/local-preferences");

    await setPendingSalonJoinSlug("demo-salon");
    await expect(getPendingSalonJoinSlug()).resolves.toBe("demo-salon");

    await clearPendingSalonJoinSlug();
    await expect(getPendingSalonJoinSlug()).resolves.toBeNull();
  });
});
