import { TrackedLink } from "../public-event";
import { CLINIC_API_BASE, type ClinicProfileViewModel } from "../../lib/clinic-profile";

const ribbonItems = [
  "Mobil klinik yönetimi",
  "SEO uyumlu klinik sayfası",
  "WhatsApp lead akışı",
  "Google Maps görünürlüğü",
  "Randevu ve paket düzeni",
  "Üye ve eğitmen takibi",
  "Mobil klinik yönetimi",
  "SEO uyumlu klinik sayfası",
  "WhatsApp lead akışı",
  "Google Maps görünürlüğü",
];

export function ClinicHero({ model }: { model: ClinicProfileViewModel }) {
  const { data, heroImage, mapsUrl, seo, serviceArea, telHref, trustFacts, whatsapp, whatsappWithMessage } = model;
  return (
    <>
      <section className="clinic-hero" style={{ ["--clinic-color" as string]: data.primary_color || "#0ea5e9" }}>
        {heroImage ? <img className="hero-photo" src={heroImage} alt={`${data.name} klinik vitrini`} fetchPriority="high" /> : null}
        <div className="clinic-hero-overlay" />
        <div className="container clinic-hero-content">
          <a className="brand on-hero" href="/">
            <span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span>
            <span>Fizyoflow</span>
          </a>
          <p className="eyebrow">{[data.business_category || "Fizyoterapi Kliniği", data.location?.district, data.location?.city].filter(Boolean).join(" · ")}</p>
          <h1>{data.hero_title || data.name}</h1>
          <p className="lead">{data.hero_subtitle || seo.description}</p>
          <div className="hero-actions">
            {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="hero" href={whatsappWithMessage} className="primary-action">WhatsApp ile Bilgi Al</TrackedLink> : null}
            {telHref ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="hero" href={telHref} className="secondary-action">Telefon Et</TrackedLink> : null}
            {mapsUrl ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="MAP_CLICK" source="hero" href={mapsUrl} className="secondary-action">Haritada Aç</TrackedLink> : null}
          </div>
          <div className="clinic-hero-facts">{trustFacts.map((fact) => <span key={fact}>{fact}</span>)}</div>
          <div className="clinic-product-orbit" aria-label="Fizyoflow klinik vitrini ürün katmanı">
            <div className="orbit-phone">
              <div className="phone-speaker" />
              <div className="phone-screen screenshot-screen"><img src="/product-screens/admin-dashboard.png" alt="Fizyoflow yönetim merkezi" width="1206" height="2622" /></div>
            </div>
            <div className="orbit-card orbit-card-seo"><span>SEO</span><strong>{serviceArea[0] ? `${serviceArea[0]} klinik vitrini` : "Yerel klinik vitrini"}</strong></div>
            <div className="orbit-card orbit-card-lead"><span>İletişim</span><strong>{whatsapp ? "WhatsApp + Harita" : "Form + Telefon"}</strong></div>
            <div className="orbit-card orbit-card-brand"><img src="/brand/fizyoflow-current-mark.png" alt="" /><strong>Fizyoflow ile yayında</strong></div>
          </div>
        </div>
      </section>
      <section className="clinic-brand-ribbon" aria-label="Fizyoflow klinik vitrin altyapısı">
        <div className="clinic-ribbon-track">{ribbonItems.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>
      </section>
    </>
  );
}
