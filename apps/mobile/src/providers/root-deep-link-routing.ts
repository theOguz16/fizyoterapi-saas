import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { resolveIncomingLinkAction } from "@/lib/incoming-link";
import {
  clearPendingSalonJoinSlug,
  getPendingSalonJoinIntent,
  setPendingSalonJoinSlug as persistPendingSalonJoinSlug,
  subscribeSalonJoinIntent,
  type SalonJoinIntent,
} from "@/lib/local-preferences";
import { resolvePendingSalonHome } from "@/lib/navigation";

type RootLinkUser = {
  role?: string | null;
  tenantSlug?: string | null;
} | null;

export function useRootDeepLinkRouting(input: {
  user: RootLinkUser;
  onboardingState?: string | null;
}) {
  const router = useRouter();
  const [pendingSalonIntent, setPendingSalonIntent] = useState<SalonJoinIntent | null | undefined>(undefined);
  const pendingSalonSlug = pendingSalonIntent === undefined ? undefined : pendingSalonIntent?.slug || null;

  useEffect(() => {
    void getPendingSalonJoinIntent().then(setPendingSalonIntent);
    return subscribeSalonJoinIntent(setPendingSalonIntent);
  }, []);

  useEffect(() => {
    if (!pendingSalonIntent) return;
    const remainingMs = new Date(pendingSalonIntent.expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      void clearPendingSalonJoinSlug();
      return;
    }

    const timer = setTimeout(() => void clearPendingSalonJoinSlug(), remainingMs);
    return () => clearTimeout(timer);
  }, [pendingSalonIntent]);

  const resolvePendingRoute = useCallback(
    (slug: string) =>
      resolvePendingSalonHome({
        pendingSalonSlug: slug,
        user: input.user,
        onboardingState: input.onboardingState,
      }),
    [input.onboardingState, input.user]
  );

  const handleIncomingUrl = useCallback(
    async (rawUrl: string | null | undefined) => {
      const action = resolveIncomingLinkAction(rawUrl, { allowE2E: isE2EModeEnabled() });

      if (action.type === "internal") {
        router.replace(action.href as never);
        return;
      }

      if (action.type !== "salon") return;

      await persistPendingSalonJoinSlug(action.slug, "DEEPLINK");

      const nextRoute = resolvePendingRoute(action.slug);
      if (nextRoute) {
        router.replace(nextRoute as never);
      }
    },
    [resolvePendingRoute, router]
  );

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) void handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, [handleIncomingUrl]);

  return {
    pendingSalonSlug,
    resolvePendingRoute,
  };
}
