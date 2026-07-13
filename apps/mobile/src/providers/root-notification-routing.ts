import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { resolveNotificationResponseHref } from "@/lib/push";

export function useRootNotificationRouting(input: {
  enabled: boolean;
  role?: string | null;
  onboardingState?: string | null;
}) {
  const router = useRouter();
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.enabled || !input.role) return;

    function openNotificationRoute(response: Notifications.NotificationResponse | null | undefined) {
      const identifier = response?.notification?.request?.identifier || null;
      if (!response || !identifier || lastHandledNotificationIdRef.current === identifier) return;

      const href = resolveNotificationResponseHref(response, {
        role: input.role,
        onboardingState: input.onboardingState,
      });
      if (!href) return;

      lastHandledNotificationIdRef.current = identifier;
      router.push(href as never);
    }

    void Notifications.getLastNotificationResponseAsync().then(openNotificationRoute);
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotificationRoute);

    return () => subscription.remove();
  }, [input.enabled, input.onboardingState, input.role, router]);
}
