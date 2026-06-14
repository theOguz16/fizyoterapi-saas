import { describe, expect, it } from "vitest";
import { normalizeNotificationPreferences } from "../controllers/mobile/notification-preferences.controller";

describe("mobile notification preferences", () => {
  it("normalizes partial payloads with trial reminder defaults", () => {
    expect(
      normalizeNotificationPreferences({
        class_reminders: { three_hours: false },
        subscription_trial_reminders: { twenty_four_hours: false },
        campaign_alerts: false,
        quiet_hours: { enabled: true, start: "23:00", end: "07:30" },
      })
    ).toEqual({
      class_reminders: { three_hours: false, one_hour: true },
      subscription_trial_reminders: {
        forty_eight_hours: true,
        twenty_four_hours: false,
        twelve_hours: true,
        four_hours: true,
      },
      package_expiry_reminders: true,
      campaign_alerts: false,
      weekly_summary: true,
      measurement_reminders: true,
      quiet_hours: { enabled: true, start: "23:00", end: "07:30" },
    });
  });

  it("replaces invalid quiet-hour clocks with safe defaults", () => {
    expect(
      normalizeNotificationPreferences({ quiet_hours: { enabled: true, start: "29:90", end: "nope" } }).quiet_hours
    ).toEqual({ enabled: true, start: "22:00", end: "08:00" });
  });
});
