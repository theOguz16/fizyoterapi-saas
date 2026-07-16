import { BrandLockup } from "../brand-lockup";
import { getClinicCanonical } from "../../lib/clinic-profile";

export function ClinicUnavailable({ slug }: { slug: string }) {
  return (
    <main className="clinic-unavailable" aria-labelledby="clinic-unavailable-title">
      <section className="clinic-unavailable-panel" role="status">
        <a className="product-brand" href="/" aria-label="FizyoFlow ana sayfa">
          <BrandLockup />
        </a>
        <p className="eyebrow">Geçici bağlantı sorunu</p>
        <h1 id="clinic-unavailable-title">Klinik bilgileri şu anda yenilenemiyor.</h1>
        <p>Sayfa kaldırılmadı. Son güncel bilgilere ulaşmak için kısa süre sonra yeniden deneyin.</p>
        <div className="clinic-unavailable-actions">
          <a className="primary-action" href={getClinicCanonical(slug)}>Yeniden Dene</a>
          <a className="secondary-action" href="/">FizyoFlow Ana Sayfa</a>
        </div>
      </section>
    </main>
  );
}
