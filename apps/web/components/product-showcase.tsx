"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faPause, faPlay } from "@fortawesome/free-solid-svg-icons";

const storySteps = [
  {
    role: "Yönetici",
    title: "Klinik güne tek ekrandan başlar.",
    text: "Yönetici bugünkü seansları, aktif danışanları, ekip yoğunluğunu ve takip gerektiren paketleri aynı yönetim merkezinde görür.",
    image: "/product-screens/admin-dashboard.png",
    details: ["Günlük operasyon özeti", "Gelir ve ekip görünürlüğü", "Paket bitiş takibi"],
  },
  {
    role: "Yönetici",
    title: "Danışan ve ekip kaydı tek yerde tutulur.",
    text: "Yönetici aktif danışanları, fizyoterapistleri, paket durumunu ve takip ihtiyacını aynı listeden ayırır.",
    image: "/product-screens/admin-members.png",
    details: ["Danışan listesi", "Fizyoterapist görünümü", "Rol ve durum filtreleri"],
  },
  {
    role: "Yönetici",
    title: "Paket ve gelir akışı görünür kalır.",
    text: "Paket kurgusu, hizmet ücretleri ve dönemsel gelir görünümü klinik sahibinin karar ekranında birleşir.",
    image: "/product-screens/admin-revenue-detail.png",
    details: ["Gelir detayı", "Paket takibi", "Dönemsel görünüm"],
  },
  {
    role: "Fizyoterapist",
    title: "Fizyoterapist günün akışını cebinde görür.",
    text: "Bugünkü seanslar, sıradaki danışan ve yapılacak check-in işlemi masa başına dönmeden hazır olur.",
    image: "/product-screens/trainer-home.png",
    details: ["Bugünkü seanslar", "Danışan bilgisi", "Günlük akış"],
  },
  {
    role: "Fizyoterapist",
    title: "Danışan dosyası sahada hazırdır.",
    text: "Aktif paket, kalan hak, son katılım, QR kodu ve ölçüm bilgileri fizyoterapistin danışan detayında görünür.",
    image: "/product-screens/trainer-client-detail.png",
    details: ["Aktif paket", "Kalan hak", "Ölçüm ve katılım"],
  },
  {
    role: "Fizyoterapist",
    title: "Check-in işlendiğinde paket hakkı güncellenir.",
    text: "QR veya manuel MEM kodu ile seans katılımı kaydedilir; doğru paketten hak düşer ve kayıt güncel kalır.",
    image: "/product-screens/trainer-checkin.png",
    details: ["QR check-in", "Manuel MEM kodu", "Otomatik hak düşümü"],
  },
  {
    role: "Danışan",
    title: "Danışan kendi sürecini uygulamada takip eder.",
    text: "Yaklaşan seans, kalan hak, grup dersleri, ölçüm ve bildirimler danışanın mobil deneyiminde bir araya gelir.",
    image: "/product-screens/member-home.png",
    details: ["Yaklaşan seans", "Ölçüm takibi", "Mobil bildirimler"],
  },
  {
    role: "Danışan",
    title: "Paket geçmişi ve yenileme ihtiyacı görünür kalır.",
    text: "Kalan hak, geçmiş paketler, ek paket talebi ve yenileme adımı danışanın paket ekranında takip edilir.",
    image: "/product-screens/member-package.png",
    details: ["Kalan hak", "Paket geçmişi", "Yenileme akışı"],
  },
  {
    role: "Danışan",
    title: "Ölçüm ve gelişim kayıtları kaybolmaz.",
    text: "Danışan güncel ölçümlerini, geçmiş değerlerini ve gelişim özetini uygulama içinde takip eder.",
    image: "/product-screens/member-measurements.png",
    details: ["Ölçüm özeti", "Geçmiş kayıt", "Gelişim takibi"],
  },
];

const roleTone: Record<string, string> = {
  Yönetici: "role-admin",
  Fizyoterapist: "role-trainer",
  Danışan: "role-member",
};

type ProductShowcaseProps = {
  hero?: boolean;
};

export function ProductShowcase({ hero = false }: ProductShowcaseProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const isAutoPlaying = playing && !interactionPaused;
  const activeStep = storySteps[stepIndex];
  const previousStep = storySteps[(stepIndex - 1 + storySteps.length) % storySteps.length];
  const nextStep = storySteps[(stepIndex + 1) % storySteps.length];
  const visibleSlides = [
    { step: previousStep, position: "previous" },
    { step: activeStep, position: "active" },
    { step: nextStep, position: "next" },
  ] as const;

  const goToStep = (nextIndex: number, nextDirection: "next" | "prev" = "next") => {
    setDirection(nextDirection);
    setStepIndex((nextIndex + storySteps.length) % storySteps.length);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = window.setInterval(() => {
      setDirection("next");
      setStepIndex((current) => (current + 1) % storySteps.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isAutoPlaying]);

  return (
    <section className={`product-showcase-section${hero ? " product-showcase-hero" : ""}`} aria-labelledby="showcase-title">
      <div className={hero ? "showcase-inner" : "product-shell"}>
        <div className="showcase-heading">
          <p className="product-kicker">Ürünü çalışırken görün</p>
          <h2 id="showcase-title">Klinik sahibi, fizyoterapist ve danışan aynı akışın farklı ekranlarını kullanır.</h2>
        </div>

        <div
          className="showcase-stage"
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
        >
          {!hero && (
            <div className="showcase-story-copy">
              <span className={`showcase-role ${roleTone[activeStep.role]}`}>{activeStep.role}</span>
              <div className="scenario-counter"><span>{String(stepIndex + 1).padStart(2, "0")}</span> / {String(storySteps.length).padStart(2, "0")}</div>
              <h3>{activeStep.title}</h3>
              <p>{activeStep.text}</p>
              <div className="showcase-detail-chips">
                {activeStep.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              <div className="scenario-progress" aria-hidden="true"><span key={stepIndex} className={isAutoPlaying ? "is-playing" : ""} /></div>
              <div className="showcase-controls">
                <button type="button" aria-label="Önceki ekran" onClick={() => goToStep(stepIndex - 1, "prev")}><FontAwesomeIcon icon={faChevronLeft} /></button>
                <button type="button" aria-label={playing ? "Akışı duraklat" : "Akışı oynat"} onClick={() => setPlaying(!playing)}><FontAwesomeIcon icon={playing ? faPause : faPlay} /></button>
                <button type="button" aria-label="Sonraki ekran" onClick={() => goToStep(stepIndex + 1, "next")}><FontAwesomeIcon icon={faChevronRight} /></button>
              </div>
            </div>
          )}

          {hero ? (
            <div className="showcase-phone-wrap showcase-phone-slider" aria-live="polite" data-direction={direction}>
              {visibleSlides.map(({ step, position }) => (
                <div
                  key={step.image}
                  className={`iphone showcase-phone-slide is-${position}`}
                  aria-hidden={position !== "active"}
                >
                  <img src={step.image} alt={position === "active" ? "Fizyoflow uygulama ekranı" : ""} />
                </div>
              ))}
            </div>
          ) : (
            <div className="showcase-phone-wrap" aria-live="polite">
              <div className="showcase-phone-shadow phone-shadow-left" aria-hidden="true">
                <img src={previousStep.image} alt="" />
              </div>
              <div className="showcase-phone-shadow phone-shadow-right" aria-hidden="true">
                <img src={nextStep.image} alt="" />
              </div>
              <div key={activeStep.image} className="iphone showcase-phone">
                <div className="iphone-island" />
                <img src={activeStep.image} alt="Fizyoflow uygulama ekranı" />
              </div>
            </div>
          )}
        </div>

        <div
          className={`showcase-story-rail${hero ? " is-compact" : ""}`}
          aria-label="Fizyoflow ürün akışı adımları"
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
          }}
        >
          {storySteps.map((step, index) => (
            <button
              type="button"
              className={stepIndex === index ? "is-active" : ""}
              onClick={() => goToStep(index, index >= stepIndex ? "next" : "prev")}
              key={`${step.role}-${step.title}`}
              aria-label={hero ? `${index + 1}. ürün ekranı` : `${step.role}: ${step.title}`}
            >
              {hero ? (
                <span className="showcase-dot" aria-hidden="true" />
              ) : (
                <>
                  <span>{step.role}</span>
                  <strong>{step.title}</strong>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
