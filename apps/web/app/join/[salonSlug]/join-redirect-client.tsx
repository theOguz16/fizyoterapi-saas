"use client";

import { useEffect, useMemo } from "react";

type JoinRedirectClientProps = {
  salonSlug: string;
  salonCode: string;
  deepLink: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
};

function resolveStoreUrl(iosStoreUrl: string, androidStoreUrl: string) {
  if (typeof navigator === "undefined") return iosStoreUrl;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return androidStoreUrl;
  return iosStoreUrl;
}

export function JoinRedirectClient({
  salonSlug,
  salonCode,
  deepLink,
  iosStoreUrl,
  androidStoreUrl,
}: JoinRedirectClientProps) {
  const storeUrl = useMemo(() => resolveStoreUrl(iosStoreUrl, androidStoreUrl), [androidStoreUrl, iosStoreUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const startedAt = Date.now();
    const fallbackTimer = window.setTimeout(() => {
      // If app opened successfully, the page usually becomes hidden.
      if (document.visibilityState === "hidden") return;
      window.location.replace(storeUrl);
    }, 1200);

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);
    window.location.replace(deepLink);

    return () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", visibilityHandler);

      // If the browser blocks immediate navigation and the page stays open, allow manual retry.
      if (Date.now() - startedAt < 250) {
        void startedAt;
      }
    };
  }, [deepLink, storeUrl]);

  return (
    <main className="container" style={{ padding: "32px 0 44px" }}>
      <section className="hero">
        <div className="hero-split">
          <div>
            <span className="chip">Salon QR yonlendirmesi</span>
            <h1 style={{ margin: "14px 0 10px" }}>Uygulama aciliyor</h1>
            <p className="muted" style={{ fontSize: "1rem", lineHeight: 1.7 }}>
              Uygulama kuruluysa dogrudan acilir. Kurulu degilse otomatik olarak indirme ekranina yonlendirilirsin.
            </p>
            <div className="hero-badges">
              <span className="chip">Salon: {salonSlug}</span>
              {salonCode ? <span className="chip">Kod: {salonCode}</span> : null}
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-mini-card">
              <strong>Kurulu degilse</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Sistem seni otomatik olarak store ekranina yonlendirecek.
              </p>
            </div>
            <div className="hero-mini-card">
              <strong>Kuruluysa</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Salonun onboarding akisina devam edersin.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
