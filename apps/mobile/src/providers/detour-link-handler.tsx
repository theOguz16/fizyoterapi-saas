import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useDetourContext } from "@swmansion/react-native-detour";
import { setPendingSalonJoinSlug } from "@/lib/local-preferences";
import { extractSalonSlugFromQrPayload } from "@/lib/salon-qr";

type Props = {
  onPendingSalonSlug: (slug: string) => void;
  resolveRoute: (slug: string) => string | null;
};

function normalizeSlugValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function readLinkField(link: unknown, key: string) {
  if (!link || typeof link !== "object") return "";

  const record = link as Record<string, unknown>;
  return String(record[key] || "").trim();
}

function readLinkParams(link: unknown) {
  if (!link || typeof link !== "object") return {};

  const record = link as Record<string, unknown>;
  const params = record.params;

  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }

  return params as Record<string, unknown>;
}

function extractSalonSlugFromDetourLink(link: unknown) {
  const params = readLinkParams(link);

  return (
    normalizeSlugValue(params.salon_slug) ||
    extractSalonSlugFromQrPayload(String(params.screen_path || "")) ||
    extractSalonSlugFromQrPayload(readLinkField(link, "pathname")) ||
    extractSalonSlugFromQrPayload(readLinkField(link, "route")) ||
    extractSalonSlugFromQrPayload(readLinkField(link, "url")) ||
    null
  );
}

export function DetourLinkHandler({ onPendingSalonSlug, resolveRoute }: Props) {
  const router = useRouter();
  const { isLinkProcessed, link, clearLink } = useDetourContext();

  useEffect(() => {
    if (!isLinkProcessed || !link) return;

    async function handleDetourLink() {
      const slug = extractSalonSlugFromDetourLink(link);

      if (!slug) {
        clearLink();
        return;
      }

      await setPendingSalonJoinSlug(slug);
      onPendingSalonSlug(slug);

      const nextRoute = resolveRoute(slug);

      if (nextRoute) {
        router.replace(nextRoute as never);
      }

      clearLink();
    }

    void handleDetourLink();
  }, [clearLink, isLinkProcessed, link, onPendingSalonSlug, resolveRoute, router]);

  return null;
}