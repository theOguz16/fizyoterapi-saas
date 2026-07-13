import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { ProductEventName, ProductEventPayload, submitProductEventApi } from "./mobile-api";
import { setProductAnalyticsHeaders } from "./http-client";

const INSTALL_ID_KEY = "fizyoflow.product-analytics.install-id.v1";
const AUTHENTICATED_EVENTS = new Set<ProductEventName>([
  "clinic_qr_viewed",
  "member_invite_started",
  "subscription_viewed",
  "purchase_started",
]);

const sessionId = createEventId("session");
const sentSessionKeys = new Set<string>();
let installIdPromise: Promise<string> | null = null;
let initializationPromise: Promise<void> | null = null;

function createEventId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

async function getInstallId() {
  if (!installIdPromise) {
    installIdPromise = AsyncStorage.getItem(INSTALL_ID_KEY).then(async (stored) => {
      if (stored) return stored;
      const created = createEventId("install");
      await AsyncStorage.setItem(INSTALL_ID_KEY, created);
      return created;
    });
  }
  return installIdPromise;
}

export function isAuthenticatedProductEvent(eventName: ProductEventName) {
  return AUTHENTICATED_EVENTS.has(eventName);
}

export function buildProductEventPayload(input: {
  eventName: ProductEventName;
  eventId: string;
  installId: string;
  sessionId: string;
  occurredAt?: Date;
  metadata?: Record<string, string | null | undefined>;
}): ProductEventPayload {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata || {}).filter((entry): entry is [string, string | null] => entry[1] !== undefined)
  );

  return {
    event_name: input.eventName,
    event_id: input.eventId,
    occurred_at: (input.occurredAt || new Date()).toISOString(),
    install_id: input.installId,
    session_id: input.sessionId,
    metadata: {
      source: "mobile",
      platform: Platform.OS,
      app_version: Application.nativeApplicationVersion || null,
      ...metadata,
    },
  };
}

export async function trackProductEvent(
  eventName: ProductEventName,
  metadata?: Record<string, string | null | undefined>,
  options?: { oncePerSession?: boolean; dedupeKey?: string }
) {
  const dedupeKey = options?.dedupeKey || eventName;
  if (options?.oncePerSession && sentSessionKeys.has(dedupeKey)) return false;
  if (options?.oncePerSession) sentSessionKeys.add(dedupeKey);

  try {
    const installId = await getInstallId();
    setProductAnalyticsHeaders({ installId, sessionId });
    const payload = buildProductEventPayload({
      eventName,
      eventId: createEventId("event"),
      installId,
      sessionId,
      metadata,
    });
    await submitProductEventApi(payload, isAuthenticatedProductEvent(eventName));
    return true;
  } catch {
    return false;
  }
}

export function initializeProductAnalytics() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const installId = await getInstallId();
      setProductAnalyticsHeaders({ installId, sessionId });
      await trackProductEvent("app_opened", { screen: "app_root" }, { oncePerSession: true });
    })().catch(() => undefined);
  }
  return initializationPromise;
}
