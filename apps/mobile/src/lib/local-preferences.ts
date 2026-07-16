// Bu helper modulu mobil tarafta local preferences ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import * as SecureStore from "expo-secure-store";
import type { SignupOnboardingProfile, SignupOnboardingRole } from "./signup-onboarding";

const PREF_KEY = "fizyoflow.notification_preferences.v2";
const PERMISSION_PROMPT_KEY = "fizyoflow.notification_permission_prompt.v1";
const SIGNUP_ONBOARDING_KEY = "fizyoflow.signup_onboarding_seen.v1";
const SIGNUP_ONBOARDING_PROFILE_KEY = "fizyoflow.signup_onboarding_profile.v1";
const SIGNUP_ONBOARDING_ROLE_KEY = "fizyoflow.signup_onboarding_role.v1";
const LEGACY_PENDING_SALON_JOIN_KEY = "fizyoflow.pending_salon_join_slug.v1";
const PENDING_SALON_JOIN_KEY = "fizyoflow.pending_salon_join_intent.v2";
const SALON_JOIN_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
const SALON_JOIN_CODE_PATTERN = /^[a-z0-9_-]{1,128}$/i;
export const LOCAL_GROUP_CLASSES_KEY = "fizyoflow.local_group_classes.v1";
const RESETTABLE_KEYS = [
  PREF_KEY,
  PERMISSION_PROMPT_KEY,
  SIGNUP_ONBOARDING_KEY,
  SIGNUP_ONBOARDING_PROFILE_KEY,
  SIGNUP_ONBOARDING_ROLE_KEY,
  LEGACY_PENDING_SALON_JOIN_KEY,
  PENDING_SALON_JOIN_KEY,
  LOCAL_GROUP_CLASSES_KEY,
  "fizyoflow.selected_city.v1",
  "fizyoflow.schedule_change_requests.v1",
];

export type NotificationPreferences = {
  classReminderThreeHours: boolean;
  classReminderOneHour: boolean;
  subscriptionTrialFortyEightHours: boolean;
  subscriptionTrialTwentyFourHours: boolean;
  subscriptionTrialTwelveHours: boolean;
  subscriptionTrialFourHours: boolean;
  campaignAlerts: boolean;
  weeklySummary: boolean;
  packageEndingAlerts: boolean;
  measurementReminders: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type NotificationPermissionPromptState = {
  hasSeenPrompt: boolean;
  lastKnownStatus: "granted" | "denied" | "undetermined";
  updatedAt: string | null;
};

export type SalonJoinIntentSource = "QR" | "DEEPLINK" | "INVITE" | "DISCOVERY";

export type SalonJoinIntent = {
  slug: string;
  source: SalonJoinIntentSource;
  code?: string;
  createdAt: string;
  expiresAt: string;
};

export type CreateSalonJoinIntentInput = {
  slug: string;
  source?: SalonJoinIntentSource;
  code?: string | null;
  now?: Date;
};

type SalonJoinIntentListener = (intent: SalonJoinIntent | null) => void;

const salonJoinIntentListeners = new Set<SalonJoinIntentListener>();

const DEFAULTS: NotificationPreferences = {
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
};

const DEFAULT_PERMISSION_PROMPT_STATE: NotificationPermissionPromptState = {
  hasSeenPrompt: false,
  lastKnownStatus: "undetermined",
  updatedAt: null,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(PREF_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      classReminderThreeHours: parsed.classReminderThreeHours ?? DEFAULTS.classReminderThreeHours,
      classReminderOneHour: parsed.classReminderOneHour ?? DEFAULTS.classReminderOneHour,
      subscriptionTrialFortyEightHours: parsed.subscriptionTrialFortyEightHours ?? DEFAULTS.subscriptionTrialFortyEightHours,
      subscriptionTrialTwentyFourHours: parsed.subscriptionTrialTwentyFourHours ?? DEFAULTS.subscriptionTrialTwentyFourHours,
      subscriptionTrialTwelveHours: parsed.subscriptionTrialTwelveHours ?? DEFAULTS.subscriptionTrialTwelveHours,
      subscriptionTrialFourHours: parsed.subscriptionTrialFourHours ?? DEFAULTS.subscriptionTrialFourHours,
      campaignAlerts: parsed.campaignAlerts ?? DEFAULTS.campaignAlerts,
      weeklySummary: parsed.weeklySummary ?? DEFAULTS.weeklySummary,
      packageEndingAlerts: parsed.packageEndingAlerts ?? DEFAULTS.packageEndingAlerts,
      measurementReminders: parsed.measurementReminders ?? DEFAULTS.measurementReminders,
      quietHoursEnabled: parsed.quietHoursEnabled ?? DEFAULTS.quietHoursEnabled,
      quietHoursStart: parsed.quietHoursStart ?? DEFAULTS.quietHoursStart,
      quietHoursEnd: parsed.quietHoursEnd ?? DEFAULTS.quietHoursEnd,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function setNotificationPreferences(next: NotificationPreferences) {
  await SecureStore.setItemAsync(PREF_KEY, JSON.stringify(next));
  return next;
}

export async function getNotificationPermissionPromptState(): Promise<NotificationPermissionPromptState> {
  try {
    const raw = await SecureStore.getItemAsync(PERMISSION_PROMPT_KEY);
    if (!raw) return DEFAULT_PERMISSION_PROMPT_STATE;
    const parsed = JSON.parse(raw) as Partial<NotificationPermissionPromptState>;
    return {
      hasSeenPrompt: parsed.hasSeenPrompt ?? DEFAULT_PERMISSION_PROMPT_STATE.hasSeenPrompt,
      lastKnownStatus: parsed.lastKnownStatus ?? DEFAULT_PERMISSION_PROMPT_STATE.lastKnownStatus,
      updatedAt: parsed.updatedAt ?? DEFAULT_PERMISSION_PROMPT_STATE.updatedAt,
    };
  } catch {
    return DEFAULT_PERMISSION_PROMPT_STATE;
  }
}

export async function setNotificationPermissionPromptState(next: NotificationPermissionPromptState) {
  await SecureStore.setItemAsync(PERMISSION_PROMPT_KEY, JSON.stringify(next));
  return next;
}

export async function hasCompletedSignupOnboarding(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(SIGNUP_ONBOARDING_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export async function setSignupOnboardingCompleted(completed: boolean) {
  await SecureStore.setItemAsync(SIGNUP_ONBOARDING_KEY, completed ? "true" : "false");
  return completed;
}

export async function getSignupOnboardingRole(): Promise<SignupOnboardingRole | null> {
  try {
    const raw = await SecureStore.getItemAsync(SIGNUP_ONBOARDING_ROLE_KEY);
    return raw === "MEMBER" || raw === "TRAINER" || raw === "ADMIN" ? raw : null;
  } catch {
    return null;
  }
}

export async function setSignupOnboardingRole(role: SignupOnboardingRole) {
  await SecureStore.setItemAsync(SIGNUP_ONBOARDING_ROLE_KEY, role);
  return role;
}

export async function getStoredSignupOnboardingProfile(role: SignupOnboardingRole): Promise<SignupOnboardingProfile | null> {
  try {
    const raw = await SecureStore.getItemAsync(SIGNUP_ONBOARDING_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<SignupOnboardingRole, SignupOnboardingProfile>>;
    return parsed[role] || null;
  } catch {
    return null;
  }
}

export async function setStoredSignupOnboardingProfile(role: SignupOnboardingRole, profile: SignupOnboardingProfile) {
  const raw = await SecureStore.getItemAsync(SIGNUP_ONBOARDING_PROFILE_KEY);
  const parsed = raw ? ((JSON.parse(raw) as Partial<Record<SignupOnboardingRole, SignupOnboardingProfile>>) || {}) : {};
  parsed[role] = profile;
  await SecureStore.setItemAsync(SIGNUP_ONBOARDING_PROFILE_KEY, JSON.stringify(parsed));
  return profile;
}

function notifySalonJoinIntent(intent: SalonJoinIntent | null) {
  salonJoinIntentListeners.forEach((listener) => listener(intent));
}

function normalizeSalonJoinIntent(raw: string | null, now: Date): SalonJoinIntent | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SalonJoinIntent>;
    const slug = String(parsed.slug || "").trim().toLowerCase();
    const source = parsed.source;
    const codeValue = String(parsed.code || "").trim();
    const code = SALON_JOIN_CODE_PATTERN.test(codeValue) ? codeValue : undefined;
    const createdAt = new Date(String(parsed.createdAt || ""));
    const expiresAt = new Date(String(parsed.expiresAt || ""));
    const validSource = source === "QR" || source === "DEEPLINK" || source === "INVITE" || source === "DISCOVERY";

    if (!slug || !validSource || Number.isNaN(createdAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      return null;
    }
    if (expiresAt.getTime() <= now.getTime()) return null;

    return {
      slug,
      source,
      ...(code ? { code } : {}),
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getPendingSalonJoinIntent(now = new Date()): Promise<SalonJoinIntent | null> {
  try {
    await SecureStore.deleteItemAsync(LEGACY_PENDING_SALON_JOIN_KEY);
    const raw = await SecureStore.getItemAsync(PENDING_SALON_JOIN_KEY);
    const intent = normalizeSalonJoinIntent(raw, now);
    if (!intent && raw) {
      await SecureStore.deleteItemAsync(PENDING_SALON_JOIN_KEY);
      notifySalonJoinIntent(null);
    }
    return intent;
  } catch {
    return null;
  }
}

export async function getPendingSalonJoinSlug(now = new Date()): Promise<string | null> {
  return (await getPendingSalonJoinIntent(now))?.slug || null;
}

export async function setPendingSalonJoinSlug(
  slug: string,
  source: SalonJoinIntentSource = "DEEPLINK",
  now = new Date()
) {
  return setPendingSalonJoinIntent({ slug, source, now });
}

export async function setPendingSalonJoinIntent({
  slug,
  source = "DEEPLINK",
  code: rawCode,
  now = new Date(),
}: CreateSalonJoinIntentInput) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) {
    await clearPendingSalonJoinSlug();
    return null;
  }

  const codeValue = String(rawCode || "").trim();
  const code = SALON_JOIN_CODE_PATTERN.test(codeValue) ? codeValue : undefined;

  const intent: SalonJoinIntent = {
    slug: normalized,
    source,
    ...(code ? { code } : {}),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SALON_JOIN_INTENT_TTL_MS).toISOString(),
  };
  await SecureStore.setItemAsync(PENDING_SALON_JOIN_KEY, JSON.stringify(intent));
  notifySalonJoinIntent(intent);
  return intent;
}

export async function clearPendingSalonJoinSlug() {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_PENDING_SALON_JOIN_KEY),
    SecureStore.deleteItemAsync(PENDING_SALON_JOIN_KEY),
  ]);
  notifySalonJoinIntent(null);
}

export function subscribeSalonJoinIntent(listener: SalonJoinIntentListener) {
  salonJoinIntentListeners.add(listener);
  return () => {
    salonJoinIntentListeners.delete(listener);
  };
}

export async function resetLocalPreferencesForE2E() {
  await Promise.all(RESETTABLE_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}

export type NotifıcationPreferences = NotificationPreferences;
export const getNotifıcationPreferences = getNotificationPreferences;
export const setNotifıcationPreferences = setNotificationPreferences;
