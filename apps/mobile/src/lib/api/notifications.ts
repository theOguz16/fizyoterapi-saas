// Mobile API notifications domain endpointleri.
import { httpRequest } from "../http-client";
import type { MobileNotificationPreferences } from "./types";

export async function getMobileNotificationPreferencesApi() {
  return httpRequest<MobileNotificationPreferences>("/mobile/notification-preferences");
}

export async function updateMobileNotificationPreferencesApi(payload: MobileNotificationPreferences) {
  return httpRequest<MobileNotificationPreferences>("/mobile/notification-preferences", {
    method: "PUT",
    body: payload,
  });
}
