import { TrackedLink } from "../public-event";
import { CLINIC_API_BASE, ROOT_LEGAL_BASE, type ClinicProfileViewModel } from "../../lib/clinic-profile";

export function ClinicClosingActions({ model }: { model: ClinicProfileViewModel }) {
  const { data, mapsUrl, telHref, whatsapp, whatsappWithMessage } = model;
  return (
    <>
      <section className="section-band" data-track-section="final-cta">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">Fizyoflow ile yayında</p>
            <h2>{data.name} dijital klinik vitrini</h2>
            <p className="small">Bu sayfa bilgilendirme amaçlıdır; tanı ve tedavi için klinik ekibiyle görüşünüz.</p>
          </div>
          {whatsapp ? (
            <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="final-cta" href={whatsappWithMessage} className="primary-action">Hemen İletişime Geç</TrackedLink>
          ) : telHref ? (
            <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="final-cta" href={telHref} className="primary-action">Telefonla Bilgi Al</TrackedLink>
          ) : null}
        </div>
      </section>
      <div className="mobile-sticky-cta">
        {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="mobile-sticky" href={whatsappWithMessage}>WhatsApp</TrackedLink> : null}
        {telHref ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="mobile-sticky" href={telHref}>Ara</TrackedLink> : null}
        {mapsUrl ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="MAP_CLICK" source="mobile-sticky" href={mapsUrl}>Harita</TrackedLink> : null}
      </div>
      <div className="desktop-sticky-cta">
        <span>Bilgi almak ister misiniz?</span>
        {whatsapp ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="WHATSAPP_CLICK" source="desktop-sticky" href={whatsappWithMessage}>WhatsApp</TrackedLink> : telHref ? <TrackedLink apiBase={CLINIC_API_BASE} slug={data.slug} eventType="PHONE_CLICK" source="desktop-sticky" href={telHref}>Telefon</TrackedLink> : null}
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
    </>
  );
}
