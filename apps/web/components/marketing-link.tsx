"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackMarketingEvent } from "./site-analytics";

type MarketingLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventName: string;
  eventSource: string;
};

function getUtmProperties() {
  const params = new URLSearchParams(window.location.search);
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].reduce<Record<string, string>>(
    (values, key) => {
      const value = params.get(key);
      if (value) values[key] = value;
      return values;
    },
    {},
  );
}

export function MarketingLink({ children, eventName, eventSource, onClick, ...props }: MarketingLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackMarketingEvent(eventName, { source: eventSource, ...getUtmProperties() });
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
