import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadForm } from "../../components/lead-form";
import { ScrollDepthTracker, SectionViewTracker, SiteEventTracker, TrackedLink } from "../../components/public-event";

export const dynamic = "force-dynamic";

type ServiceItem = {
  title?: string;
  desc?: string;
  starting_price?: string;
  display_price?: string;
  type?: string;
};

type SalonPageData = {
  id: string;
  name: string;
  slug: string;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  google_business_url?: string | null;
  google_maps_url?: string | null;
  business_category?: string | null;
  service_area?: string[];
  managed_growth_status?: string;
  digital_brief?: {
    logo_url?: string;
    gallery_urls?: string[];
    working_hours_note?: string;
    review_url?: string;
    campaign_note?: string;
    target_audience?: string;
    brand_voice?: string;
  };
  about_text?: string | null;
  why_us?: Array<{ title?: string; desc?: string }>;
  services?: ServiceItem[];
  location?: {
    city?: string;
    district?: string;
    phone?: string;
    address?: string;
    maps_embed_url?: string;
  };
  social_links?: {
    instagram?: string;
    website?: string;
    whatsapp?: string;
  };
  primary_color?: string;
  business_hours?: {
    working_days?: number[];
    start_time?: string;
    end_time?: string;
  };
  gallery_images?: Array<{ id: string; url: string; sort_order?: number; meta?: Record<string, unknown> }>;
};

type PageProps = {
  params: { salonSlug: string };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:4949/api";
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com";
const DEFAULT_SHARE_IMAGE = "/brand/fizyoflow-og.svg";
const ROOT_LEGAL_BASE = "https://fizyoflow.com";

function publicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

async function getSalon(slug: string): Promise<SalonPageData | null> {
  try {
    const response = await fetch(`${API_BASE}/public/salons/${slug}`, {
      next: { revalidate: 300 },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function getCanonical(slug: string) {
  try {
    const root = new URL(WEB_BASE);
    return `${root.protocol}//${slug}.${root.hostname.replace(/^www\./, "")}`;
  } catch {
    return `https://${slug}.fizyoflow.com`;
  }
}

function resolveSeo(data: SalonPageData) {
  const location = [data.location?.district, data.location?.city].filter(Boolean).join(" ");
  const title = data.seo_title || `${data.name} | ${location ? `${location} ` : ""}Fizyoterapi ve Klinik Hizmetleri`;
  const description =
    data.seo_description ||
    data.hero_subtitle ||
    `${data.name} için fizyoterapi, klinik pilates ve hareket odaklı hizmetler. Bilgi ve randevu talebi için iletişime geçin.`;
  return { title, description };
}

function buildWhatsAppUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.hostname.includes("wa.me")) {
      const phone = url.pathname.replace(/\D+/g, "");
      return phone.length >= 7 && phone.length <= 15 ? `https://wa.me/${phone}` : "";
    }
    if (url.hostname.includes("whatsapp.com")) {
      const phone = url.searchParams.get("phone")?.replace(/\D+/g, "") || url.pathname.replace(/\D+/g, "");
      return phone.length >= 7 && phone.length <= 15 ? `https://wa.me/${phone}` : "";
    }
  } catch {
    // Plain phone numbers continue below.
  }

  let phone = raw.replace(/\D+/g, "");
  if (phone.length === 10 && phone.startsWith("5")) phone = `90${phone}`;
  if (phone.length === 11 && phone.startsWith("0")) phone = `90${phone.slice(1)}`;
  if (phone.length < 7 || phone.length > 15) return "";
  return `https://wa.me/${phone}`;
}

function withWhatsAppMessage(url: string, message: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("text", message);
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildTelHref(value?: string | null) {
  const phone = String(value || "").replace(/[^\d+]/g, "");
  return phone.length >= 7 ? `tel:${phone}` : "";
}

function slugifySource(value?: string) {
  return String(value || "service")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "service";
}

function getOpenStatus(
  activeDays: number[],
  startTime?: string,
  endTime?: string
) {
  if (!activeDays.length || !startTime || !endTime) return "";

  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekdayText = parts.find((part) => part.type === "weekday")?.value.toLowerCase() || "";
  const currentTime = `${parts.find((part) => part.type === "hour")?.value || "00"}:${parts.find((part) => part.type === "minute")?.value || "00"}`;
  const weekdayMap: Record<string, number> = {
    pzt: 1,
    pts: 1,
    sal: 2,
    çar: 3,
    car: 3,
    per: 4,
    cum: 5,
    cmt: 6,
    paz: 7,
  };
  const today = weekdayMap[weekdayText.slice(0, 3)] || 0;
  if (!activeDays.includes(today)) return "Bugün kapalı olabilir";
  return currentTime >= startTime && currentTime <= endTime ? "Bugün açık olabilir" : "Bugün çalışma saati dışında olabilir";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getSalon(params.salonSlug);
  if (!data) {
    return {
      title: "Klinik bulunamadı | Fizyoflow",
    };
  }
  const seo = resolveSeo(data);
  const canonical = getCanonical(data.slug);
  const image = publicUrl(data.hero_image_url || data.gallery_images?.[0]?.url) || DEFAULT_SHARE_IMAGE;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: "Fizyoflow",
      type: "website",
      images: [
        {
          url: image,
          width: image === DEFAULT_SHARE_IMAGE ? 1200 : undefined,
          height: image === DEFAULT_SHARE_IMAGE ? 630 : undefined,
          alt: `${data.name} Fizyoflow klinik vitrini`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [image],
    },
  };
}

const weekdayLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const schemaWeekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default async function SalonPublicPage({ params }: PageProps) {
  const data = await getSalon(params.salonSlug);
  if (!data) notFound();

  const seo = resolveSeo(data);
  const canonical = getCanonical(data.slug);
  const heroImage = publicUrl(data.hero_image_url || data.gallery_images?.[0]?.url);
  const phone = data.location?.phone || "";
  const whatsappRaw = data.social_links?.whatsapp || phone;
  const whatsapp = buildWhatsAppUrl(whatsappRaw);
  const defaultWhatsAppMessage = `Merhaba, ${data.name} Fizyoflow sayfanızdan ulaşıyorum. Bilgi almak istiyorum.`;
  const whatsappWithMessage = withWhatsAppMessage(whatsapp, defaultWhatsAppMessage);
  const telHref = buildTelHref(phone);
  const mapsUrl = data.google_maps_url || data.location?.maps_embed_url || "";
  const services = (data.services || []).filter((service) => service.title).slice(0, 9);
  const gallery = Array.from(
    new Map(
      [
        ...(data.gallery_images || []).map((image) => ({ id: image.id, url: image.url })),
        ...(data.digital_brief?.gallery_urls || []).map((url, index) => ({ id: `brief-${index}`, url })),
      ]
        .filter((image) => image.url)
        .map((image) => [image.url, image])
    ).values()
  ).slice(0, 6);
  const activeDays = data.business_hours?.working_days || [];
  const locationText = [data.location?.district, data.location?.city].filter(Boolean).join(", ");
  const serviceArea = data.service_area?.length ? data.service_area : [data.location?.district, data.location?.city].filter(Boolean);
  const workingHourText =
    activeDays.length && data.business_hours?.start_time && data.business_hours?.end_time
      ? `${activeDays.map((day) => weekdayLabels[day - 1]).filter(Boolean).join(", ")} · ${data.business_hours.start_time}-${data.business_hours.end_time}`
      : data.digital_brief?.working_hours_note || "Bilgi için iletişime geçin";
  const openStatus = getOpenStatus(activeDays, data.business_hours?.start_time, data.business_hours?.end_time);
  const trustFacts = [
    data.business_category || "Fizyoterapi Kliniği",
    locationText || "Yerel klinik vitrini",
    openStatus,
    data.managed_growth_status === "live" ? "Fizyoflow ile yayında" : "Fizyoflow vitrini",
  ].filter(Boolean);
  const visibilityCards = [
    { title: "Google'a hazır", body: seo.title },
    { title: "Hızlı iletişim", body: whatsapp ? "WhatsApp, telefon ve form aksiyonları tek yerde." : "Telefon ve form aksiyonları tek yerde." },
    { title: "Yerel güven", body: serviceArea.length ? `${serviceArea.join(", ")} bölgesi için net klinik bilgisi.` : "Adres, hizmet ve iletişim bilgisi birlikte sunulur." },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: data.name,
    description: seo.description,
    url: canonical,
    image: heroImage || undefined,
    telephone: phone || undefined,
    address: data.location?.address
      ? {
          "@type": "PostalAddress",
          streetAddress: data.location.address,
          addressLocality: [data.location.district, data.location.city].filter(Boolean).join(", "),
          addressCountry: "TR",
        }
      : undefined,
    sameAs: [data.google_business_url, data.social_links?.instagram, data.social_links?.website].filter(Boolean),
    areaServed: data.service_area,
    openingHours: activeDays.length && data.business_hours?.start_time && data.business_hours?.end_time
      ? activeDays.map((day) => `${schemaWeekdayLabels[day - 1] || "Mo"} ${data.business_hours?.start_time}-${data.business_hours?.end_time}`)
      : undefined,
  };

  return (
    <main>
      <SiteEventTracker apiBase={API_BASE} slug={data.slug} />
      <ScrollDepthTracker apiBase={API_BASE} slug={data.slug} />
      <SectionViewTracker apiBase={API_BASE} slug={data.slug} sections={["contact", "services", "location", "gallery", "final-cta"]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="clinic-hero" style={{ ["--clinic-color" as string]: data.primary_color || "#0ea5e9" }}>
        {heroImage ? <img className="hero-photo" src={heroImage} alt={`${data.name} klinik vitrini`} fetchPriority="high" /> : null}
        <div className="clinic-hero-overlay" />
        <div className="container clinic-hero-content">
          <a className="brand on-hero" href="/">
            <span className="brand-mark"><img src="/brand/fizyoflow-mark.svg" alt="" /></span>
            <span>Fizyoflow</span>
          </a>
          <p className="eyebrow">{[data.business_category || "Fizyoterapi Kliniği", data.location?.district, data.location?.city].filter(Boolean).join(" · ")}</p>
          <h1>{data.hero_title || data.name}</h1>
          <p className="lead">{data.hero_subtitle || seo.description}</p>
          <div className="hero-actions">
            {whatsapp ? (
              <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="hero" href={whatsappWithMessage} className="primary-action">
                WhatsApp ile Bilgi Al
              </TrackedLink>
            ) : null}
            {telHref ? (
              <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="hero" href={telHref} className="secondary-action">
                Telefon Et
              </TrackedLink>
            ) : null}
            {mapsUrl ? (
              <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="MAP_CLICK" source="hero" href={mapsUrl} className="secondary-action">
                Haritada Aç
              </TrackedLink>
            ) : null}
          </div>
          <div className="clinic-hero-facts">
            {trustFacts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
          <div className="clinic-product-orbit" aria-label="Fizyoflow klinik vitrini ürün katmanı">
            <div className="orbit-phone">
              <div className="phone-speaker" />
              <div className="phone-screen screenshot-screen">
                <img src="/product-screens/admin-dashboard.png" alt="Fizyoflow yönetim merkezi" width="1206" height="2622" />
              </div>
            </div>
            <div className="orbit-card orbit-card-seo">
              <span>SEO</span>
              <strong>{serviceArea[0] ? `${serviceArea[0]} klinik vitrini` : "Yerel klinik vitrini"}</strong>
            </div>
            <div className="orbit-card orbit-card-lead">
              <span>İletişim</span>
              <strong>{whatsapp ? "WhatsApp + Harita" : "Form + Telefon"}</strong>
            </div>
            <div className="orbit-card orbit-card-brand">
              <img src="/brand/fizyoflow-mark.svg" alt="" />
              <strong>Fizyoflow ile yayında</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="clinic-brand-ribbon" aria-label="Fizyoflow klinik vitrin altyapısı">
        <div className="clinic-ribbon-track">
          {[
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
          ].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section-band" data-track-section="contact">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Klinik Hakkında</p>
            <h2>{data.name}</h2>
            <p>{data.about_text || seo.description}</p>
            <div className="quick-contact">
              {whatsapp ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="contact-card" href={whatsapp} className="contact-pill">
                  WhatsApp
                </TrackedLink>
              ) : null}
              {telHref ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="contact-card" href={telHref} className="contact-pill">
                  Telefon
                </TrackedLink>
              ) : null}
              {mapsUrl ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="MAP_CLICK" source="contact-card" href={mapsUrl} className="contact-pill">
                  Haritada Aç
                </TrackedLink>
              ) : null}
              {data.google_business_url ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="MAP_CLICK" source="google-business" href={data.google_business_url} className="contact-pill">
                  Google Profilini Aç
                </TrackedLink>
              ) : null}
              {data.social_links?.instagram ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="INSTAGRAM_CLICK" source="contact-card" href={data.social_links.instagram} className="contact-pill">
                  Instagram
                </TrackedLink>
              ) : null}
              {data.digital_brief?.review_url ? (
                <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="REVIEW_CLICK" source="contact-card" href={data.digital_brief.review_url} className="contact-pill">
                  Yorum Bırak
                </TrackedLink>
              ) : null}
            </div>
            <div className="clinic-highlight-grid">
              <div className="clinic-highlight">
                <span>Bölge</span>
                <strong>{serviceArea.length ? serviceArea.join(", ") : locationText || "Klinik lokasyonu"}</strong>
              </div>
              <div className="clinic-highlight">
                <span>Çalışma</span>
                <strong>{openStatus ? `${openStatus} · ${workingHourText}` : workingHourText}</strong>
              </div>
              <div className="clinic-highlight">
                <span>İletişim</span>
                <strong>{phone || whatsapp ? "WhatsApp, telefon ve bilgi formu" : "Bilgi formu üzerinden dönüş"}</strong>
              </div>
            </div>
          </div>
          <aside className="contact-card">
            <div className="contact-card-brand">
              <img src="/brand/fizyoflow-mark.svg" alt="" />
              <span>Fizyoflow lead formu</span>
            </div>
            <p className="eyebrow">Hızlı İletişim</p>
            <h3>Bilgi ve Randevu Talebi</h3>
            <p className="small">Formu doldurun; klinik ekibi size uygun zaman ve hizmet bilgisiyle dönüş yapar.</p>
            <LeadForm
              slug={data.slug}
              apiBase={API_BASE}
              quickContactHref={whatsappWithMessage || undefined}
              quickContactLabel="WhatsApp'tan hızlıca yazın"
            />
            {whatsapp ? (
              <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="lead-form-after-note" href={whatsappWithMessage} className="form-whatsapp-link">
                Daha hızlı dönüş için WhatsApp'tan yazın
              </TrackedLink>
            ) : null}
          </aside>
        </div>
      </section>

      {data.digital_brief?.campaign_note || data.digital_brief?.target_audience || data.digital_brief?.brand_voice ? (
        <section className="section-band clinic-message-band">
          <div className="container split-section">
            <div>
              <p className="eyebrow">Klinik Yaklaşımı</p>
              <h2>İlk temas kısa, anlaşılır ve güven veren bir dille başlar.</h2>
              <p>
                {data.digital_brief?.target_audience ||
                  "Sayfa, danışanın ihtiyacını hızlıca anlayıp doğru iletişim aksiyonuna yönlendirmek için hazırlanır."}
              </p>
            </div>
            <div className="clinic-message-card">
              <span>{data.digital_brief?.brand_voice || "Sakin, klinik ve güven veren dil"}</span>
              <p>{data.digital_brief?.campaign_note || "Kampanya, yorum ve paylaşım notları Fizyoflow ekibi tarafından vitrine uygun hale getirilir."}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section-band clinic-visibility-band">
        <div className="container section-heading">
          <p className="eyebrow">Dijital Güven</p>
          <h2>Danışan ilk bakışta nerede olduğunuzu, ne sunduğunuzu ve nasıl ulaşacağını görür.</h2>
        </div>
        <div className="container clinic-visibility-grid">
          {visibilityCards.map((card) => (
            <article className="clinic-visibility-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {services.length ? (
        <section className="section-band muted-band" data-track-section="services">
          <div className="container section-heading">
            <p className="eyebrow">Hizmetler</p>
            <h2>Kliniğin öne çıkan hizmetleri</h2>
          </div>
          <div className="container service-grid">
            {services.map((service) => (
              <article className="service-card" key={`${service.title}-${service.type || ""}`}>
                <h3>{service.title}</h3>
                {service.desc ? <p>{service.desc}</p> : null}
                {service.desc ? (
                  <details className="service-detail">
                    <summary>Kimler için uygun?</summary>
                    <p>{service.desc} İlk adım olarak klinik ekibinden uygun program, süre ve başlangıç bilgisi alabilirsiniz.</p>
                  </details>
                ) : null}
                {service.starting_price || service.display_price ? <span>{service.starting_price || service.display_price}</span> : null}
                {whatsapp ? (
                  <TrackedLink
                    apiBase={API_BASE}
                    slug={data.slug}
                    eventType="WHATSAPP_CLICK"
                    source={`service-${slugifySource(service.title)}`}
                    href={withWhatsAppMessage(whatsapp, `Merhaba, ${data.name} Fizyoflow sayfanızdan ulaşıyorum. ${service.title} hakkında bilgi almak istiyorum.`)}
                    className="service-cta"
                  >
                    Bu hizmet için bilgi al
                  </TrackedLink>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mapsUrl || data.location?.address ? (
        <section className="section-band location-band" data-track-section="location">
          <div className="container split-section">
            <div>
              <p className="eyebrow">Konum</p>
              <h2>{locationText ? `${locationText} konumunda kolay ulaşım` : "Kliniğe ulaşım bilgileri"}</h2>
              <p>{data.location?.address || "Harita ve ulaşım bilgisi için klinik ekibiyle iletişime geçebilirsiniz."}</p>
              <div className="quick-contact">
                {mapsUrl ? (
                  <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="MAP_CLICK" source="location-section" href={mapsUrl} className="contact-pill">
                    Haritada Aç
                  </TrackedLink>
                ) : null}
                {whatsapp ? (
                  <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="location-section" href={whatsappWithMessage} className="contact-pill">
                    Yol Tarifi İçin Yazın
                  </TrackedLink>
                ) : null}
              </div>
            </div>
            <div className="location-card">
              {data.location?.maps_embed_url ? (
                <iframe src={data.location.maps_embed_url} title={`${data.name} harita`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <div className="map-fallback">
                  <strong>{data.name}</strong>
                  <span>{locationText || data.location?.address || "Klinik konumu"}</span>
                  {mapsUrl ? <a href={mapsUrl}>Google Haritalar'da aç</a> : null}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {gallery.length ? (
        <section className="section-band" data-track-section="gallery">
          <div className="container section-heading">
            <p className="eyebrow">Galeri</p>
            <h2>Kliniği yakından görün</h2>
          </div>
          <div className="container gallery-grid">
            {gallery.map((image) => (
              <img key={image.id} src={publicUrl(image.url)} alt={`${data.name} galeri`} loading="lazy" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-band" data-track-section="final-cta">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">Fizyoflow ile yayında</p>
            <h2>{data.name} dijital klinik vitrini</h2>
            <p className="small">Bu sayfa bilgilendirme amaçlıdır; tanı ve tedavi için klinik ekibiyle görüşünüz.</p>
          </div>
          {whatsapp ? (
            <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="final-cta" href={whatsappWithMessage} className="primary-action">
              Hemen İletişime Geç
            </TrackedLink>
          ) : telHref ? (
            <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="final-cta" href={telHref} className="primary-action">
              Telefonla Bilgi Al
            </TrackedLink>
          ) : null}
        </div>
      </section>

      <div className="mobile-sticky-cta">
        {whatsapp ? (
          <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="mobile-sticky" href={whatsappWithMessage}>
            WhatsApp
          </TrackedLink>
        ) : null}
        {telHref ? (
          <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="mobile-sticky" href={telHref}>
            Ara
          </TrackedLink>
        ) : null}
        {mapsUrl ? (
          <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="MAP_CLICK" source="mobile-sticky" href={mapsUrl}>
            Harita
          </TrackedLink>
        ) : null}
      </div>
      <div className="desktop-sticky-cta">
        <span>Bilgi almak ister misiniz?</span>
        {whatsapp ? (
          <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="desktop-sticky" href={whatsappWithMessage}>
            WhatsApp
          </TrackedLink>
        ) : telHref ? (
          <TrackedLink apiBase={API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="desktop-sticky" href={telHref}>
            Telefon
          </TrackedLink>
        ) : null}
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>Fizyoflow ile yayında</span>
          <nav>
            <a href={`${ROOT_LEGAL_BASE}/gizlilik-politikasi`}>Gizlilik</a>
            <a href={`${ROOT_LEGAL_BASE}/privacy-policy`}>Privacy</a>
            <a href={`${ROOT_LEGAL_BASE}/hesap-silme`}>Hesap Silme</a>
            <a href={`${ROOT_LEGAL_BASE}/kvkk`}>KVKK</a>
            <a href={`${ROOT_LEGAL_BASE}/cerez-politikasi`}>Çerezler</a>
            <a href={`${ROOT_LEGAL_BASE}/kullanim-sartlari`}>Kullanım Şartları</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
