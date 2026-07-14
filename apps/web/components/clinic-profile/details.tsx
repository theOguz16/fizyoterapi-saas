import { LeadForm } from "../lead-form";
import { TrackedLink } from "../public-event";
import {
  CLINIC_API_BASE,
  publicClinicUrl,
  slugifyClinicSource,
  type ClinicProfileViewModel,
  withWhatsAppMessage,
} from "../../lib/clinic-profile";

export function ClinicContactSection({ model }: { model: ClinicProfileViewModel }) {
  const { data, locationText, mapsUrl, openStatus, phone, seo, serviceArea, telHref, whatsapp, whatsappWithMessage, workingHourText } = model;
  return (
    <section className="section-band" data-track-section="contact">
      <div className="container split-section">
        <div>
          <p className="eyebrow">Klinik Hakkında</p>
          <h2>{data.name}</h2>
          <p>{data.about_text || seo.description}</p>
          <div className="quick-contact">
            {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="contact-card" href={whatsapp} className="contact-pill">WhatsApp</TrackedLink> : null}
            {telHref ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="contact-card" href={telHref} className="contact-pill">Telefon</TrackedLink> : null}
            {mapsUrl ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="MAP_CLICK" source="contact-card" href={mapsUrl} className="contact-pill">Haritada Aç</TrackedLink> : null}
            {data.google_business_url ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="MAP_CLICK" source="google-business" href={data.google_business_url} className="contact-pill">Google Profilini Aç</TrackedLink> : null}
            {data.social_links?.instagram ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="INSTAGRAM_CLICK" source="contact-card" href={data.social_links.instagram} className="contact-pill">Instagram</TrackedLink> : null}
            {data.digital_brief?.review_url ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="REVIEW_CLICK" source="contact-card" href={data.digital_brief.review_url} className="contact-pill">Yorum Bırak</TrackedLink> : null}
          </div>
          <div className="clinic-highlight-grid">
            <div className="clinic-highlight"><span>Bölge</span><strong>{serviceArea.length ? serviceArea.join(", ") : locationText || "Klinik lokasyonu"}</strong></div>
            <div className="clinic-highlight"><span>Çalışma</span><strong>{openStatus ? `${openStatus} · ${workingHourText}` : workingHourText}</strong></div>
            <div className="clinic-highlight"><span>İletişim</span><strong>{phone || whatsapp ? "WhatsApp, telefon ve bilgi formu" : "Bilgi formu üzerinden dönüş"}</strong></div>
          </div>
        </div>
        <aside className="contact-card">
          <div className="contact-card-brand"><img src="/brand/fizyoflow-current-mark.png" alt="" /><span>Fizyoflow lead formu</span></div>
          <p className="eyebrow">Hızlı İletişim</p>
          <h3>Bilgi ve Randevu Talebi</h3>
          <p className="small">Formu doldurun; klinik ekibi size uygun zaman ve hizmet bilgisiyle dönüş yapar.</p>
          <LeadForm slug={data.slug} apiBase={CLINIC_API_BASE} quickContactHref={whatsappWithMessage || undefined} quickContactLabel="WhatsApp'tan hızlıca yazın" />
          {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="lead-form-after-note" href={whatsappWithMessage} className="form-whatsapp-link">Daha hızlı dönüş için WhatsApp'tan yazın</TrackedLink> : null}
        </aside>
      </div>
    </section>
  );
}

export function ClinicMessageAndVisibility({ model }: { model: ClinicProfileViewModel }) {
  const { data, visibilityCards } = model;
  const hasMessage = data.digital_brief?.campaign_note || data.digital_brief?.target_audience || data.digital_brief?.brand_voice;
  return (
    <>
      {hasMessage ? (
        <section className="section-band clinic-message-band">
          <div className="container split-section">
            <div>
              <p className="eyebrow">Klinik Yaklaşımı</p>
              <h2>İlk temas kısa, anlaşılır ve güven veren bir dille başlar.</h2>
              <p>{data.digital_brief?.target_audience || "Sayfa, danışanın ihtiyacını hızlıca anlayıp doğru iletişim aksiyonuna yönlendirmek için hazırlanır."}</p>
            </div>
            <div className="clinic-message-card">
              <span>{data.digital_brief?.brand_voice || "Sakin, klinik ve güven veren dil"}</span>
              <p>{data.digital_brief?.campaign_note || "Kampanya, yorum ve paylaşım notları Fizyoflow ekibi tarafından vitrine uygun hale getirilir."}</p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="section-band clinic-visibility-band">
        <div className="container section-heading"><p className="eyebrow">Dijital Güven</p><h2>Danışan ilk bakışta nerede olduğunuzu, ne sunduğunuzu ve nasıl ulaşacağını görür.</h2></div>
        <div className="container clinic-visibility-grid">
          {visibilityCards.map((card) => <article className="clinic-visibility-card" key={card.title}><h3>{card.title}</h3><p>{card.body}</p></article>)}
        </div>
      </section>
    </>
  );
}

export function ClinicServicesSection({ model }: { model: ClinicProfileViewModel }) {
  const { data, services, whatsapp } = model;
  if (!services.length) return null;
  return (
    <section className="section-band muted-band" data-track-section="services">
      <div className="container section-heading"><p className="eyebrow">Hizmetler</p><h2>Kliniğin öne çıkan hizmetleri</h2></div>
      <div className="container service-grid">
        {services.map((service) => (
          <article className="service-card" key={`${service.title}-${service.type || ""}`}>
            <h3>{service.title}</h3>
            {service.desc ? <p>{service.desc}</p> : null}
            {service.desc ? <details className="service-detail"><summary>Kimler için uygun?</summary><p>{service.desc} İlk adım olarak klinik ekibinden uygun program, süre ve başlangıç bilgisi alabilirsiniz.</p></details> : null}
            {service.starting_price || service.display_price ? <span>{service.starting_price || service.display_price}</span> : null}
            {whatsapp ? (
              <TrackedLink
                apiBase={CLINIC_API_BASE}
                slug={data.slug}
                eventType="WHATSAPP_CLICK"
                source={`service-${slugifyClinicSource(service.title)}`}
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
  );
}

export function ClinicLocationAndGallery({ model }: { model: ClinicProfileViewModel }) {
  const { data, gallery, locationText, mapsUrl, whatsapp, whatsappWithMessage } = model;
  return (
    <>
      {mapsUrl || data.location?.address ? (
        <section className="section-band location-band" data-track-section="location">
          <div className="container split-section">
            <div>
              <p className="eyebrow">Konum</p>
              <h2>{locationText ? `${locationText} konumunda kolay ulaşım` : "Kliniğe ulaşım bilgileri"}</h2>
              <p>{data.location?.address || "Harita ve ulaşım bilgisi için klinik ekibiyle iletişime geçebilirsiniz."}</p>
              <div className="quick-contact">
                {mapsUrl ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="MAP_CLICK" source="location-section" href={mapsUrl} className="contact-pill">Haritada Aç</TrackedLink> : null}
                {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="location-section" href={whatsappWithMessage} className="contact-pill">Yol Tarifi İçin Yazın</TrackedLink> : null}
              </div>
            </div>
            <div className="location-card">
              {data.location?.maps_embed_url ? (
                <iframe src={data.location.maps_embed_url} title={`${data.name} harita`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <div className="map-fallback"><strong>{data.name}</strong><span>{locationText || data.location?.address || "Klinik konumu"}</span>{mapsUrl ? <a href={mapsUrl}>Google Haritalar'da aç</a> : null}</div>
              )}
            </div>
          </div>
        </section>
      ) : null}
      {gallery.length ? (
        <section className="section-band" data-track-section="gallery">
          <div className="container section-heading"><p className="eyebrow">Galeri</p><h2>Kliniği yakından görün</h2></div>
          <div className="container gallery-grid">{gallery.map((image) => <img key={image.id} src={publicClinicUrl(image.url)} alt={`${data.name} galeri`} loading="lazy" />)}</div>
        </section>
      ) : null}
    </>
  );
}
