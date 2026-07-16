"use client";

import { useEffect, useMemo } from "react";
import { resolveJoinStoreUrl } from "../../../lib/join-redirect";

type JoinRedirectClientProps = {
  salonSlug: string;
  salonCode: string;
  deepLink: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
};

export function JoinRedirectClient({
  salonSlug,
  salonCode,
  deepLink,
  iosStoreUrl,
  androidStoreUrl,
}: JoinRedirectClientProps) {
  const storeUrl = useMemo(
    () => resolveJoinStoreUrl(typeof navigator === "undefined" ? "" : navigator.userAgent, iosStoreUrl, androidStoreUrl),
    [androidStoreUrl, iosStoreUrl]
  );

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
    <main className="join-page">
      <section className="container join-panel">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span>
          <span>Fizyoflow</span>
        </a>
        <div className="join-grid">
          <div>
            <p className="eyebrow">Klinik daveti</p>
            <h1>Uygulama açılıyor.</h1>
            <p className="lead">
              Fizyoflow kuruluysa klinik akışına devam edeceksiniz. Kurulu değilse indirme ekranına otomatik
              yönlendirilirsiniz.
            </p>
            <div className="join-actions">
              <a className="primary-action" href={deepLink}>Uygulamayı Aç</a>
              <a className="secondary-action" href={storeUrl}>İndirme Ekranına Git</a>
            </div>
            <div className="join-tags">
              <span>Salon: {salonSlug}</span>
              {salonCode ? <span>Davet kodu bağlantıya eklendi</span> : null}
            </div>
          </div>
          <div className="join-status-card">
            <span className="join-pulse" aria-hidden="true" />
            <h2>Güvenli yönlendirme</h2>
            <p>Bu ekran yalnızca klinik davetini mobil uygulamadaki doğru onboarding akışına taşır.</p>
            <div className="join-status-list">
              <span>Kuruluysa uygulama açılır</span>
              <span>Kurulu değilse mağazaya gider</span>
              <span>Klinik kodu korunur</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
