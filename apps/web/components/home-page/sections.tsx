import { BrandLockup } from "../brand-lockup";
import { DemoLeadForm } from "../demo-lead-form";
import { MarketingFaqList } from "../marketing-faq-list";
import { MarketingLink } from "../marketing-link";
import { ProductScreenImage } from "../product-screen-image";
import { ProductShowcase } from "../product-showcase";
import { TrackedGallery } from "../tracked-gallery";
import {
  APP_STORE_URL,
  CANONICAL_DESCRIPTION,
  comparisonItems,
  faqItems,
  featuredScreens,
  productExplainers,
  screenGroups,
  trustItems,
} from "./content";

export function HomeIntroAndNavigation() {
  return (
    <>
      <div className="brand-intro" aria-hidden="true">
        <div className="brand-intro-inner">
          <img src="/brand/fizyoflow-current-mark.png" alt="" />
          <strong>Fizyoflow</strong>
          <span>Mobil klinik yönetimi tek akışta.</span>
        </div>
      </div>
      <header className="product-nav">
        <a className="product-brand" href="/" aria-label="Fizyoflow ana sayfa"><BrandLockup /></a>
        <nav>
          <a href="#urun">Ürün</a>
          <MarketingLink href="#demo" eventName="demo_section_click" eventSource="header">Demo</MarketingLink>
        </nav>
      </header>
    </>
  );
}

export function HomeHero() {
  return (
    <section className="product-hero">
      <div className="hero-beams" aria-hidden="true" />
      <div className="product-shell product-hero-grid">
        <div className="product-hero-copy">
          <p className="product-kicker">Fizyoterapi ve pilates klinikleri için</p>
          <h1>Fizyoflow <span className="hero-highlight">mobil klinik yönetim platformu.</span></h1>
          <p className="product-lead">Randevu, paket, danışan, ekip, QR ve gelir/seans takibini tek merkezden yönetin. Fizyoterapistler ve danışanlar, kliniğinizin güncel akışına kendi mobil ekranlarından bağlansın.</p>
          <div className="product-store-actions" aria-label="Fizyoflow uygulama indirme bağlantıları">
            <MarketingLink className="store-button store-button-active" href={APP_STORE_URL} target="_blank" rel="noreferrer" eventName="app_store_click" eventSource="hero">
              <span>App Store</span><strong>iPhone için indir</strong>
            </MarketingLink>
            <span className="store-button store-button-soon" aria-disabled="true"><span>Google Play</span><strong>Yakında</strong></span>
          </div>
        </div>
        <ProductShowcase hero />
      </div>
    </section>
  );
}

export function ProductExplanationSection() {
  return (
    <section className="product-explain-section">
      <div className="product-shell product-explain-grid">
        <div className="product-section-heading">
          <p className="product-kicker">Fizyoflow nedir?</p>
          <h2>Klinik operasyonunu tek merkezde tutan, ekip ve danışan deneyimini bu merkeze bağlayan platform.</h2>
          <p>Fizyoflow yalnızca bir takvim değildir. Başvuru, seans planı, paket hakkı, ödeme durumu, check-in, ölçüm geçmişi ve yenileme takibini birbirine bağlar.</p>
        </div>
        <div className="product-explain-cards">
          {productExplainers.map((item) => (
            <article className="product-explain-card" key={item.role}><span>{item.role}</span><h3>{item.title}</h3><p>{item.text}</p></article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComparisonSection() {
  return (
    <section className="comparison-section" aria-labelledby="comparison-title">
      <div className="product-shell comparison-grid">
        <div className="product-section-heading">
          <p className="product-kicker">WhatsApp + Excel yerine Fizyoflow</p>
          <h2 id="comparison-title">Klinik işi mesajlarda değil, güncel kayıtta ilerler.</h2>
          <p>Seans, paket, ödeme ve danışan bilgisi ayrı yerlerde kaldığında ekip aynı dosyanın farklı versiyonlarıyla çalışır.</p>
        </div>
        <div className="comparison-board" aria-label="Dağınık takip ile Fizyoflow karşılaştırması">
          <div className="comparison-column comparison-column-muted">
            <span>Dağınık takip</span>
            {comparisonItems.map((item) => <p key={item.scattered}><strong>{item.scattered}</strong><small>Kontrol kişiye ve mesaja bağlı kalır.</small></p>)}
          </div>
          <div className="comparison-divider" aria-hidden="true">
            {comparisonItems.map((item, index) => <span key={`${item.flow}-${index}`} />)}
          </div>
          <div className="comparison-column comparison-column-flow">
            <span>Fizyoflow akışı</span>
            {comparisonItems.map((item) => <p key={item.flow}><strong>{item.flow}</strong><small>{item.result}</small></p>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OperationalFlowSection() {
  const features = ["Takvim", "Paketler", "Check-in", "Danışanlar", "Ölçümler", "Grup dersleri", "Gelir takibi"];
  return (
    <section className="operational-flow-section" aria-labelledby="operational-flow-title">
      <div className="product-shell">
        <div className="product-section-heading">
          <p className="product-kicker">Klinik akışı</p>
          <h2 id="operational-flow-title">Bir kayıt ilerlediğinde takvim, paket ve takip bilgisi birlikte güncellenir.</h2>
        </div>
        <div className="operational-flow">
          <svg className="operational-flow-lines" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
            <path className="operational-flow-path operational-flow-path-1" d="M219 178 C326 178 348 260 414 260" />
            <path className="operational-flow-path operational-flow-path-2" d="M219 260 C326 260 350 260 414 260" />
            <path className="operational-flow-path operational-flow-path-3" d="M219 342 C326 342 348 260 414 260" />
            <path className="operational-flow-path operational-flow-path-4" d="M586 260 C665 260 690 92 781 92" />
            <path className="operational-flow-path operational-flow-path-5" d="M586 260 C665 260 690 148 781 148" />
            <path className="operational-flow-path operational-flow-path-6" d="M586 260 C665 260 690 204 781 204" />
            <path className="operational-flow-path operational-flow-path-7" d="M586 260 C670 260 710 260 781 260" />
            <path className="operational-flow-path operational-flow-path-8" d="M586 260 C665 260 690 316 781 316" />
            <path className="operational-flow-path operational-flow-path-9" d="M586 260 C665 260 690 372 781 372" />
            <path className="operational-flow-path operational-flow-path-10" d="M586 260 C665 260 690 428 781 428" />
          </svg>
          <div className="operational-flow-inputs">
            <span className="operational-role">Yönetici</span><span className="operational-role">Fizyoterapist</span><span className="operational-role">Danışan</span>
          </div>
          <div className="operational-flow-core"><img src="/brand/fizyoflow-current-mark.png" alt="" /><strong>Fizyoflow</strong></div>
          <div className="operational-flow-results">{features.map((feature) => <span className="operational-feature" key={feature}>{feature}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

function FeaturedScreens() {
  return (
    <div className="featured-screens" aria-label="Fizyoflow öne çıkan ürün ekranları">
      {featuredScreens.map((screen) => (
        <article className="featured-screen-card" key={screen.title}>
          <div className="iphone featured-screen-phone" aria-hidden="true"><ProductScreenImage src={screen.image} fallbackSrc={screen.fallbackImage} alt="" priority={false} /></div>
          <div><span>{screen.role}</span><h3>{screen.title}</h3><p>{screen.text}</p></div>
        </article>
      ))}
    </div>
  );
}

export function ProductScreensSection() {
  return (
    <section id="urun" className="product-screens-section">
      <div className="product-shell">
        <div className="product-section-heading">
          <p className="product-kicker">Gerçek ürün ekranları</p>
          <h2>Klinik yönetiminden ekip ve danışan deneyimine uzanan tek ürün.</h2>
          <p>Klinik sahibi operasyonu yönetir; fizyoterapist seansı işler, danışan kendi sürecini uygulamada görür.</p>
        </div>
        <FeaturedScreens />
        <TrackedGallery className="role-screen-gallery">
          {screenGroups.map((group, groupIndex) => (
            <section className="role-screen-group" key={group.role} aria-label={`${group.role} ekranları`}>
              <div className="role-screen-heading"><span>{group.role}</span><p>{group.summary}</p></div>
              <div className="role-screen-row">
                {group.screens.map((screen, index) => (
                  <article className="screen-item" key={`${group.role}-${screen.label}`}>
                    <div className="iphone iphone-gallery">
                      <div className="iphone-island" />
                      <ProductScreenImage src={screen.image} fallbackSrc={group.fallbackImage} alt={`Fizyoflow ${group.role} rolünde ${screen.label} ekranı: ${screen.detail}`} priority={groupIndex === 0 && index === 0} />
                    </div>
                    <div className="screen-caption"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{screen.label}</h3><p>{screen.detail}</p></div></div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </TrackedGallery>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="product-trust-section">
      <div className="product-shell trust-panel">
        <div className="trust-copy"><p className="product-kicker">Güven ve kontrol</p><h2>Kontrol, herkesin her şeyi görmesi değil; doğru kişinin doğru bilgiye erişmesidir.</h2><p>Fizyoflow, klinik içindeki erişimi kullanıcı rolüne göre ayırır ve danışan sürecini dağınık hesaplar yerine düzenli kayıtlarla yürütür.</p></div>
        <div className="trust-grid">
          {trustItems.map((item, index) => (
            <article className="trust-card" key={item.title}><div className="trust-card-meta"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><small>{item.label}</small></div><div><h3>{item.title}</h3><p>{item.text}</p></div></article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="product-faq-section">
      <div className="product-shell product-faq-grid">
        <div className="product-section-heading"><p className="product-kicker">Sık sorulanlar</p><h2>Fizyoflow’u arayan kişinin hızlıca cevap bulacağı kısa ürün özeti.</h2><p>{CANONICAL_DESCRIPTION}</p></div>
        <MarketingFaqList items={[...faqItems]} />
      </div>
    </section>
  );
}

export function DemoSection() {
  return (
    <section id="demo" className="product-demo-section">
      <div className="product-shell product-demo-grid">
        <div className="product-demo-copy"><img src="/brand/fizyoflow-current-mark.png" alt="" /><p className="product-kicker">Kısa bir görüşmeyle başlayın</p><h2>15 dakikada klinik operasyonunuzun nerede dağıldığını birlikte çıkaralım.</h2><p>Randevu, paket, ekip, QR, danışan bilgilendirmesi ve gelir/seans takibinin nasıl tek akışta sadeleşeceğini netleştiririz.</p></div>
        <DemoLeadForm compact />
      </div>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className="product-footer">
      <div className="product-shell product-footer-inner">
        <a href="/" aria-label="Fizyoflow ana sayfa"><BrandLockup compact /></a>
        <nav><a href="/gizlilik-politikasi">Gizlilik</a><a href="/kvkk">KVKK</a><a href="/kullanim-sartlari">Kullanım Şartları</a></nav>
      </div>
    </footer>
  );
}
