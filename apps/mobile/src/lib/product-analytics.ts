import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { AUTHENTICATED_PRODUCT_EVENT_NAMES } from "@fitnes-saas/contracts";
import { ProductEventName, ProductEventPayload, submitProductEventApi } from "./mobile-api";
import { getAuthToken, setProductAnalyticsHeaders } from "./http-client";

const INSTALL_ID_KEY = "fizyoflow.product-analytics.install-id.v1";
const FUNNEL_ID_KEY = "fizyoflow.product-analytics.funnel-id.v1";
const QUEUE_KEY = "fizyoflow.product-analytics.queue.v2";
const MAX_QUEUE_SIZE = 500;
const AUTHENTICATED_EVENTS = new Set<ProductEventName>(AUTHENTICATED_PRODUCT_EVENT_NAMES);

type QueuedProductEvent = {
  payload: ProductEventPayload;
  authenticated: boolean;
  attempt_count: number;
  next_attempt_at: string;
};

const sessionId = createEventId("session");
const sentSessionKeys = new Set<string>();
let installIdPromise: Promise<string> | null = null;
let funnelIdPromise: Promise<string> | null = null;
let initializationPromise: Promise<void> | null = null;
let queueLock: Promise<unknown> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function createEventId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function getOrCreateId(key: string, prefix: string) {
  return AsyncStorage.getItem(key).then(async (stored) => {
    if (stored) return stored;
    const created = createEventId(prefix);
    await AsyncStorage.setItem(key, created);
    return created;
  });
}

async function getInstallId() {
  if (!installIdPromise) installIdPromise = getOrCreateId(INSTALL_ID_KEY, "install");
  return installIdPromise;
}

async function getFunnelId() {
  if (!funnelIdPromise) funnelIdPromise = getOrCreateId(FUNNEL_ID_KEY, "funnel");
  return funnelIdPromise;
}

function withQueueLock<T>(operation: () => Promise<T>) {
  const result = queueLock.then(operation, operation);
  queueLock = result.then(() => undefined, () => undefined);
  return result;
}

function parseQueue(raw: string | null): QueuedProductEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QueuedProductEvent => Boolean(
      item && typeof item === "object" && item.payload?.event_id && item.payload?.event_name
    )).slice(-MAX_QUEUE_SIZE);
  } catch {
    return [];
  }
}

async function readQueue() {
  return parseQueue(await AsyncStorage.getItem(QUEUE_KEY));
}

async function writeQueue(queue: QueuedProductEvent[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
}

async function enqueue(payload: ProductEventPayload, authenticated: boolean) {
  return withQueueLock(async () => {
    const queue = await readQueue();
    if (queue.some((item) => item.payload.event_id === payload.event_id)) return;
    queue.push({ payload, authenticated, attempt_count: 0, next_attempt_at: new Date().toISOString() });
    await writeQueue(queue);
  });
}

function retryDelayMs(attemptCount: number) {
  return Math.min(60 * 60 * 1000, 5_000 * 2 ** Math.min(attemptCount, 10));
}

function scheduleRetry(queue: QueuedProductEvent[]) {
  if (retryTimer) clearTimeout(retryTimer);
  const dueTimes = queue
    .filter((item) => !item.authenticated || Boolean(getAuthToken()))
    .map((item) => new Date(item.next_attempt_at).getTime())
    .filter(Number.isFinite);
  if (!dueTimes.length) return;
  const delay = Math.max(1_000, Math.min(...dueTimes) - Date.now());
  retryTimer = setTimeout(() => void flushProductEventQueue().catch(() => undefined), delay);
}

export function isAuthenticatedProductEvent(eventName: ProductEventName) {
  return AUTHENTICATED_EVENTS.has(eventName);
}

export function buildProductEventPayload(input: {
  eventName: ProductEventName;
  eventId: string;
  installId: string;
  sessionId: string;
  funnelId: string;
  occurredAt?: Date;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}): ProductEventPayload {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata || {}).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined)
  );

  return {
    event_name: input.eventName,
    event_id: input.eventId,
    occurred_at: (input.occurredAt || new Date()).toISOString(),
    install_id: input.installId,
    session_id: input.sessionId,
    funnel_id: input.funnelId,
    metadata: {
      source: "mobile",
      platform: Platform.OS,
      app_version: Application.nativeApplicationVersion || null,
      ...metadata,
    },
  };
}

export function flushProductEventQueue() {
  return withQueueLock(async () => {
    const queue = await readQueue();
    const remaining: QueuedProductEvent[] = [];
    const now = Date.now();

    for (const item of queue) {
      if (item.authenticated && !getAuthToken()) {
        remaining.push(item);
        continue;
      }
      if (new Date(item.next_attempt_at).getTime() > now) {
        remaining.push(item);
        continue;
      }
      try {
        await submitProductEventApi(item.payload, item.authenticated);
      } catch {
        const attemptCount = item.attempt_count + 1;
        remaining.push({
          ...item,
          attempt_count: attemptCount,
          next_attempt_at: new Date(Date.now() + retryDelayMs(attemptCount)).toISOString(),
        });
      }
    }

    await writeQueue(remaining);
    scheduleRetry(remaining);
    return { sent: queue.length - remaining.length, pending: remaining.length };
  });
}

export async function trackProductEvent(
  eventName: ProductEventName,
  metadata?: Record<string, string | number | boolean | null | undefined>,
  options?: { oncePerSession?: boolean; dedupeKey?: string }
) {
  const dedupeKey = options?.dedupeKey || eventName;
  if (options?.oncePerSession && sentSessionKeys.has(dedupeKey)) return false;

  try {
    const [installId, funnelId] = await Promise.all([getInstallId(), getFunnelId()]);
    setProductAnalyticsHeaders({ installId, sessionId, funnelId });
    const payload = buildProductEventPayload({
      eventName,
      eventId: createEventId("event"),
      installId,
      sessionId,
      funnelId,
      metadata,
    });
    await enqueue(payload, isAuthenticatedProductEvent(eventName));
    if (options?.oncePerSession) sentSessionKeys.add(dedupeKey);
    void flushProductEventQueue().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function initializeProductAnalytics() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const [installId, funnelId] = await Promise.all([getInstallId(), getFunnelId()]);
      setProductAnalyticsHeaders({ installId, sessionId, funnelId });
      await flushProductEventQueue();
      await trackProductEvent("app_opened", { screen: "app_root" }, { oncePerSession: true });
    })().catch(() => undefined);
  }
  return initializationPromise;
}
