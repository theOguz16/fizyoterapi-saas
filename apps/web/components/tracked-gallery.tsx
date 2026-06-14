"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { trackMarketingEvent } from "./site-analytics";

export function TrackedGallery({ children, className }: { children: ReactNode; className: string }) {
  const tracked = useRef(false);

  function trackOnce() {
    if (tracked.current) return;
    tracked.current = true;
    trackMarketingEvent("product_gallery_interaction", { source: "product_screen_gallery" });
  }

  return (
    <div className={className} onPointerDown={trackOnce} onScroll={trackOnce}>
      {children}
    </div>
  );
}
