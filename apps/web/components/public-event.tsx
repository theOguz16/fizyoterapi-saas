"use client";

import { ReactNode, useEffect } from "react";
import { trackMarketingEvent } from "./site-analytics";

type PublicEvent = "PAGE_VIEW" | "LEAD_SUBMIT" | "WHATSAPP_CLICK" | "PHONE_CLICK" | "MAP_CLICK" | "INSTAGRAM_CLICK" | "REVIEW_CLICK" | "SECTION_VIEW";

export function getPublicAttribution() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const values = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .map((key) => [key, params.get(key)] as const)
    .filter(([, value]) => value);
  const referrer = document.referrer ? new URL(document.referrer).hostname : "";
  return [
    ...values.map(([key, value]) => `${key}:${value}`),
    referrer ? `ref:${referrer}` : "",
  ]
    .filter(Boolean)
    .join("|")
    .slice(0, 80);
}

export async function trackPublicEvent(apiBase: string, slug: string, eventType: PublicEvent, source?: string) {
  try {
    const attribution = getPublicAttribution();
    trackMarketingEvent(`clinic_${eventType.toLowerCase()}`, {
      clinic_slug: slug,
      source,
      attribution: attribution || undefined,
    });
    await fetch(`${apiBase}/public/salons/${slug}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        source,
        page_path: typeof window === "undefined" ? "" : window.location.pathname,
        section: attribution || undefined,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the visitor flow.
  }
}

export function ScrollDepthTracker({ apiBase, slug }: { apiBase: string; slug: string }) {
  useEffect(() => {
    const sent = new Set<number>();
    const marks = [25, 50, 75, 90];
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const depth = Math.round((window.scrollY / scrollable) * 100);
      for (const mark of marks) {
        if (depth >= mark && !sent.has(mark)) {
          sent.add(mark);
          trackPublicEvent(apiBase, slug, "SECTION_VIEW", `scroll-${mark}`);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [apiBase, slug]);

  return null;
}

export function SiteEventTracker({ apiBase, slug }: { apiBase: string; slug: string }) {
  useEffect(() => {
    trackPublicEvent(apiBase, slug, "PAGE_VIEW", "clinic-public-page");
  }, [apiBase, slug]);

  return null;
}

export function SectionViewTracker({ apiBase, slug, sections }: { apiBase: string; slug: string; sections: string[] }) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = (entry.target as HTMLElement).dataset.trackSection || "";
          if (!section || seen.has(section)) continue;
          seen.add(section);
          trackPublicEvent(apiBase, slug, "SECTION_VIEW", section);
        }
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0.2 }
    );

    for (const section of sections) {
      const node = document.querySelector(`[data-track-section="${section}"]`);
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [apiBase, sections, slug]);

  return null;
}

export function TrackedLink({
  apiBase,
  slug,
  eventType,
  source,
  href,
  className,
  children,
}: {
  apiBase: string;
  slug: string;
  eventType: PublicEvent;
  source: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        trackPublicEvent(apiBase, slug, eventType, source);
      }}
    >
      {children}
    </a>
  );
}
