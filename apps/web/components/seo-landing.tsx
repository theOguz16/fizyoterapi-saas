import Image from "next/image";
import { BrandLockup } from "./brand-lockup";

type SeoLandingFaq = {
  question: string;
  answer: string;
};

export type SeoLandingContent = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  outcomes: string[];
  sections: Array<{
    title: string;
    text: string;
  }>;
  faq: SeoLandingFaq[];
};

export function SeoLanding({ content }: { content: SeoLandingContent }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="seo-nav">
        <a href="/" className="product-brand" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <a href="/#demo">Demo Talep Et</a>
      </header>

      <section className="seo-hero product-shell">
        <div>
          <p className="product-kicker">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <div className="iphone seo-phone">
          <div className="iphone-island" />
          <Image
            src={content.image}
            alt={content.imageAlt}
            width={1206}
            height={2622}
            sizes="(max-width: 620px) 68vw, 244px"
            priority
          />
        </div>
      </section>

      <section className="seo-outcomes product-shell" aria-label="Fizyoflow sonuçları">
        {content.outcomes.map((item, index) => (
          <article key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{item}</p>
          </article>
        ))}
      </section>

      <section className="seo-content product-shell">
        {content.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>

      <section className="seo-faq product-shell">
        <div className="product-section-heading">
          <p className="product-kicker">Kısa cevaplar</p>
          <h2>Fizyoflow hakkında sık sorulanlar</h2>
        </div>
        <div className="product-faq-list">
          {content.faq.map((item) => (
            <article className="product-faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
