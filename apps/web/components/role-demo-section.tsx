"use client";

import { useState } from "react";
import { ProductScreenImage } from "./product-screen-image";

type RoleDemoTab = {
  role: string;
  eyebrow: string;
  title: string;
  image: string;
  fallbackImage: string;
  flow: string[];
  points: string[];
};

type RoleDemoSectionProps = {
  tabs: RoleDemoTab[];
};

export function RoleDemoSection({ tabs }: RoleDemoSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = tabs[activeIndex] || tabs[0];

  return (
    <section className="role-demo-section" aria-labelledby="role-demo-title">
      <div className="product-shell">
        <div className="product-section-heading">
          <p className="product-kicker">Kliniğe bağlı mobil deneyim</p>
          <h2 id="role-demo-title">Klinik yönetimi merkezde kalır, her kullanıcı görevine uygun ekranı görür.</h2>
          <p>Fizyoterapist ve danışan ekranları ayrı ürünler değil, kliniğin güncel operasyonuna bağlı çalışma alanlarıdır.</p>
        </div>

        <div className="role-demo-panel">
          <div className="role-demo-copy">
            <div className="role-demo-tabs" role="tablist" aria-label="Fizyoflow klinik operasyonu görünümleri">
              {tabs.map((tab, index) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "is-active" : ""}
                  onClick={() => setActiveIndex(index)}
                  key={tab.role}
                >
                  {tab.role}
                </button>
              ))}
            </div>
            <div className="role-demo-text">
              <span>{activeTab.eyebrow}</span>
              <h3>{activeTab.title}</h3>
              <div className="role-demo-flow" aria-label={`${activeTab.role} akışı`}>
                {activeTab.flow.map((step, index) => (
                  <span key={step}>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    {step}
                  </span>
                ))}
              </div>
              <ul>
                {activeTab.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
          </div>

          <div className="role-demo-phone-wrap" aria-live="polite">
            <div className="iphone role-demo-phone" key={activeTab.image}>
              <div className="iphone-island" />
              <ProductScreenImage
                src={activeTab.image}
                fallbackSrc={activeTab.fallbackImage}
                alt={`Fizyoflow ${activeTab.role} rolü demo ekranı`}
                priority={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
