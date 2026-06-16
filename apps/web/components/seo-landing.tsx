import Image from "next/image";
import { BrandLockup } from "./brand-lockup";
import { MarketingLink } from "./marketing-link";

type SeoLandingFaq = {
  question: string;
  answer: string;
};

export type SeoLandingContent = {
  eyebrow: string;
  title: string;
  description: string;
  slug: string;
  ctaText: string;
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
  const webBase = (process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
  const pageUrl = `${webBase}/${content.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: content.title,
        url: pageUrl,
        description: content.description,
        inLanguage: "tr-TR",
        isPartOf: { "@id": `${webBase}/#website` },
        primaryImageOfPage: `${webBase}${content.image}`,
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: content.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Fizyoflow", item: webBase },
          { "@type": "ListItem", position: 2, name: content.eyebrow, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="seo-nav">
        <a href="/" className="product-brand" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <MarketingLink href="/#demo" eventName="seo_demo_click" eventSource={content.slug}>
          Demo Talep Et
        </MarketingLink>
      </header>

      <section className="seo-hero product-shell">
        <div>
          <p className="product-kicker">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <div className="seo-hero-actions">
            <MarketingLink className="product-primary" href="/#demo" eventName="seo_primary_cta_click" eventSource={content.slug}>
              {content.ctaText}
            </MarketingLink>
            <a className="product-secondary" href="/#urun">Ürün ekranlarını gör</a>
          </div>
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

      <section className="seo-cta product-shell">
        <div>
          <p className="product-kicker">Fizyoflow ile ilerleyin</p>
          <h2>Seans, paket ve danışan takibini aynı güncel kayıt üzerinde konuşalım.</h2>
        </div>
        <MarketingLink className="product-primary" href="/#demo" eventName="seo_bottom_cta_click" eventSource={content.slug}>
          Demo Talep Et
        </MarketingLink>
      </section>

      <footer className="product-footer seo-footer">
        <div className="product-shell product-footer-inner">
          <a href="/" aria-label="Fizyoflow ana sayfa">
            <BrandLockup compact />
          </a>
          <nav>
            <a href="/gizlilik-politikasi">Gizlilik</a>
            <a href="/kvkk">KVKK</a>
            <a href="/kullanim-sartlari">Kullanım Şartları</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
