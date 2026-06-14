// Bu controller mobil bildirim tercihlerini hesap bazinda saklar.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const DEFAULT_NOTIFICATION_PREFERENCES = {
  class_reminders: { three_hours: true, one_hour: true },
  subscription_trial_reminders: { forty_eight_hours: true, twenty_four_hours: true, twelve_hours: true, four_hours: true },
  package_expiry_reminders: true,
  campaign_alerts: true,
  weekly_summary: true,
  measurement_reminders: true,
  quiet_hours: { enabled: false, start: "22:00", end: "08:00" },
};

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeQuietHours(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const normalizeClock = (input: unknown, fallback: string) => {
    if (typeof input !== "string") return fallback;
    const match = /^(\d{2}):(\d{2})$/.exec(input);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return fallback;
    return input;
  };
  const start = normalizeClock(source.start, "22:00");
  const end = normalizeClock(source.end, "08:00");
  return {
    enabled: normalizeBoolean(source.enabled, false),
    start,
    end,
  };
}

export function normalizeNotificationPreferences(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const classReminders = source.class_reminders && typeof source.class_reminders === "object" ? (source.class_reminders as Record<string, unknown>) : {};
  const trialReminders =
    source.subscription_trial_reminders && typeof source.subscription_trial_reminders === "object"
      ? (source.subscription_trial_reminders as Record<string, unknown>)
      : {};

  return {
    class_reminders: {
      three_hours: normalizeBoolean(classReminders.three_hours, DEFAULT_NOTIFICATION_PREFERENCES.class_reminders.three_hours),
      one_hour: normalizeBoolean(classReminders.one_hour, DEFAULT_NOTIFICATION_PREFERENCES.class_reminders.one_hour),
    },
    subscription_trial_reminders: {
      forty_eight_hours: normalizeBoolean(
        trialReminders.forty_eight_hours,
        DEFAULT_NOTIFICATION_PREFERENCES.subscription_trial_reminders.forty_eight_hours
      ),
      twenty_four_hours: normalizeBoolean(
        trialReminders.twenty_four_hours,
        DEFAULT_NOTIFICATION_PREFERENCES.subscription_trial_reminders.twenty_four_hours
      ),
      twelve_hours: normalizeBoolean(
        trialReminders.twelve_hours,
        DEFAULT_NOTIFICATION_PREFERENCES.subscription_trial_reminders.twelve_hours
      ),
      four_hours: normalizeBoolean(trialReminders.four_hours, DEFAULT_NOTIFICATION_PREFERENCES.subscription_trial_reminders.four_hours),
    },
    package_expiry_reminders: normalizeBoolean(source.package_expiry_reminders, DEFAULT_NOTIFICATION_PREFERENCES.package_expiry_reminders),
    campaign_alerts: normalizeBoolean(source.campaign_alerts, DEFAULT_NOTIFICATION_PREFERENCES.campaign_alerts),
    weekly_summary: normalizeBoolean(source.weekly_summary, DEFAULT_NOTIFICATION_PREFERENCES.weekly_summary),
    measurement_reminders: normalizeBoolean(source.measurement_reminders, DEFAULT_NOTIFICATION_PREFERENCES.measurement_reminders),
    quiet_hours: normalizeQuietHours(source.quiet_hours),
  };
}

export class MobileNotificationPreferencesController {
  private static async getAccount(req: AuthenticatedRequest) {
    const accountId = req.auth?.accountId;
    if (!accountId) {
      throw new AppError("NO_ACCOUNT", 400, "Hesap bilgisi bulunamadi");
    }

    const repo = AppDataSource.getRepository(Account);
    const account = await repo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new AppError("ACCOUNT_NOT_FOUND", 404, "Hesap bulunamadi");
    }
    return { repo, account };
  }

  static async getMine(req: AuthenticatedRequest, res: Response) {
    const { account } = await MobileNotificationPreferencesController.getAccount(req);
    return res.json({ data: normalizeNotificationPreferences(account.notification_preferences) });
  }

  static async updateMine(req: AuthenticatedRequest, res: Response) {
    const { repo, account } = await MobileNotificationPreferencesController.getAccount(req);
    account.notification_preferences = normalizeNotificationPreferences(req.body);
    await repo.save(account);
    return res.json({ data: account.notification_preferences });
  }
}
