"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_KEY = "fizyoflow_analytics_consent";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
type AnalyticsConsent = "unknown" | "granted" | "declined";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    posthog?: {
      init?: (key: string, options?: Record<string, unknown>) => void;
      capture?: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

function hasExternalAnalytics() {
  return Boolean(GA_ID || POSTHOG_KEY);
}

function readConsent() {
  if (typeof window === "undefined") return "unknown";
  const consent = window.localStorage.getItem(CONSENT_KEY);
  return consent === "granted" || consent === "declined" ? consent : "unknown";
}

export function trackMarketingEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (GA_ID && window.gtag) {
    window.gtag("event", eventName, properties || {});
  }
  if (POSTHOG_KEY && window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
  }
}

export function SiteAnalytics() {
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!hasExternalAnalytics()) return null;

  function accept() {
    window.localStorage.setItem(CONSENT_KEY, "granted");
    setConsent("granted");
    trackMarketingEvent("analytics_consent_granted", { source: "cookie_banner" });
  }

  function decline() {
    window.localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
  }

  return (
    <>
      {consent === "granted" && GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="fizyoflow-ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}
      {consent === "granted" && POSTHOG_KEY ? (
        <Script id="fizyoflow-posthog" strategy="afterInteractive">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags reloadFeatureFlags group get_group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${POSTHOG_KEY}', { api_host: '${POSTHOG_HOST}', capture_pageview: true, persistence: 'localStorage+cookie' });
          `}
        </Script>
      ) : null}
      {ready && consent === "unknown" ? (
        <div className="cookie-banner" role="dialog" aria-label="Analitik tercihleri">
          <p>
            Zorunlu güvenlik ölçümleri dışında, siteyi ve klinik vitrinlerini iyileştirmek için anonim analitik
            kullanmak istiyoruz.
          </p>
          <div>
            <button type="button" className="secondary-action" onClick={decline}>Reddet</button>
            <button type="button" onClick={accept}>Kabul Et</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
