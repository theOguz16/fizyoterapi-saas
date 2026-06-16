import type { Metadata } from "next";
import { BrandLockup } from "../components/brand-lockup";
import { DemoLeadForm } from "../components/demo-lead-form";
import { MarketingFaqList } from "../components/marketing-faq-list";
import { MarketingLink } from "../components/marketing-link";
import { ProductScreenImage } from "../components/product-screen-image";
import { ProductShowcase } from "../components/product-showcase";
import { TrackedGallery } from "../components/tracked-gallery";

const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
const APP_STORE_URL = "https://apps.apple.com/tr/app/fizyoflow/id6771870032?l=tr";
const CANONICAL_DESCRIPTION = "Fizyoflow, fizyoterapi klinikleri için seans, paket, check-in, ekip ve danışan takibini tek mobil akışta toplayan yönetim sistemidir.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const screenGroups = [
  {
    role: "Yönetici",
    fallbackImage: "/product-screens/admin-dashboard.png",
    summary: "Klinik sahibi seans, paket, ödeme ve ekip yoğunluğunu aynı merkezden takip eder.",
    screens: [
      { label: "Yönetim merkezi", detail: "Günün seans, danışan ve operasyon özeti", image: "/product-screens/admin-dashboard.png" },
      { label: "Salon takvimi", detail: "Ekip programı ve bireysel seanslar", image: "/product-screens/admin-calendar.png" },
      { label: "Danışan ve ekip listesi", detail: "Rol, paket ve takip durumuna göre filtreleme", image: "/product-screens/admin-members.png" },
      { label: "Danışan detayı", detail: "Paket, katılım, ölçüm ve risk geçmişi", image: "/product-screens/admin-member-detail.png" },
      { label: "Fizyoterapist detayı", detail: "Kazanç, ders ve yetkinlik görünümü", image: "/product-screens/admin-trainer-detail.png" },
      { label: "Paket yönetimi", detail: "Hizmet, fiyat, hak ve ekip eşleştirmesi", image: "/product-screens/admin-packages.png" },
      { label: "Gelir detayı", detail: "Satışlar, tahmin ve dönemsel gelir analizi", image: "/product-screens/admin-revenue-detail.png" },
      { label: "Kampanyalar", detail: "Referans, sadakat ve indirim kuralları", image: "/product-screens/admin-campaigns.png" },
    ],
  },
  {
    role: "Fizyoterapist",
    fallbackImage: "/product-screens/trainer-home.png",
    summary: "Fizyoterapist günlük seanslarını, danışan bilgisini ve check-in işlemini cebinden yürütür.",
    screens: [
      { label: "Günlük ana ekran", detail: "Bugünkü seanslar ve hızlı işlemler", image: "/product-screens/trainer-home.png" },
      { label: "Bugünün akışı", detail: "Sıradaki seans, risk ve son check-in", image: "/product-screens/trainer-today.png" },
      { label: "Check-in", detail: "QR veya kodla katılım ve hak düşümü", image: "/product-screens/trainer-checkin.png" },
      { label: "Danışan detayı", detail: "Aktif paket, katılım ve ölçüm bilgileri", image: "/product-screens/trainer-client-detail.png" },
      { label: "Grup dersleri", detail: "Ders oluşturma, paket ve davet yönetimi", image: "/product-screens/trainer-group-classes.png" },
      { label: "Fizyoterapist QR", detail: "Klinik içi kimlik ve yetki doğrulama", image: "/product-screens/trainer-qr.png" },
      { label: "Profil ve uzmanlık", detail: "Hesap, yetkinlik ve iletişim bilgileri", image: "/product-screens/trainer-profile.png" },
    ],
  },
  {
    role: "Danışan",
    fallbackImage: "/product-screens/member-home.png",
    summary: "Danışan yaklaşan seansını, kalan hakkını ve paket geçmişini uygulamada takip eder.",
    screens: [
      { label: "Danışan ana ekranı", detail: "Sonraki seans, kalan hak ve günlük özet", image: "/product-screens/member-home.png" },
      { label: "Seans detayı", detail: "Saat, fizyoterapist ve giriş durumu", image: "/product-screens/member-booking-detail.png" },
      { label: "Paket ve haklar", detail: "Kalan kullanım, geçmiş ve ödeme bilgisi", image: "/product-screens/member-package.png" },
      { label: "Ölçüm özeti", detail: "Güncel değerler ve değişim grafikleri", image: "/product-screens/member-measurements.png" },
      { label: "Ölçüm geçmişi", detail: "Tarihli fiziksel gelişim kayıtları", image: "/product-screens/member-measurement-history.png" },
      { label: "Gelişim", detail: "Katılım, paket kullanımı ve ölçüm trendi", image: "/product-screens/member-progress.png" },
      { label: "Ders giriş QR", detail: "Doğru seanstan otomatik hak düşümü", image: "/product-screens/member-qr.png" },
      { label: "Referanslar", detail: "Arkadaş daveti ve kazanım takibi", image: "/product-screens/member-referrals.png" },
      { label: "Profil", detail: "Hesap ve üyelik işlemleri", image: "/product-screens/member-profile.png" },
    ],
  },
];

const trustItems = [
  {
    label: "Erişim",
    title: "Her rol kendi ekranını görür.",
    text: "Klinik sahibi operasyonu, fizyoterapist seans akışını, danışan ise kendi sürecini takip eder.",
  },
  {
    label: "Hesap düzeni",
    title: "Tüm ekip üyeleri bir arada çalışır.",
    text: "Her ekip üyesi kendi hesabıyla çalışır; erişim görev alanına ve kullanıcı rolüne göre ayrılır.",
  },
  {
    label: "Şeffaflık",
    title: "Yasal metinler erişilebilirdir.",
    text: "KVKK, gizlilik, kullanım şartları ve hesap silme süreçleri kullanıcıdan saklanmadan sunulur.",
  },
  {
    label: "Kayıt bütünlüğü",
    title: "Klinik geçmişi bölünmez.",
    text: "Seans, paket, check-in ve ölçüm kayıtları danışan süreciyle bağlantılı biçimde güncel kalır.",
  },
];

const productExplainers = [
  {
    role: "Klinik sahibi",
    title: "Operasyon görünür olur",
    text: "Seans, paket, gelir ve ekip akışı yönetim ekranında birlikte okunur.",
  },
  {
    role: "Fizyoterapist",
    title: "Seans sahada tamamlanır",
    text: "Günlük akış, danışan detayı ve check-in işlemi mobilde hazırdır.",
  },
  {
    role: "Danışan",
    title: "Süreç danışana görünür",
    text: "Yaklaşan seans, kalan hak, ölçüm ve gelişim bilgisi uygulamada takip edilir.",
  },
];

const comparisonItems = [
  { scattered: "WhatsApp konuşmaları", flow: "Tek danışan kaydı", result: "Not, paket ve seans geçmişi aynı dosyada kalır." },
  { scattered: "Excel paket takibi", flow: "Otomatik kalan hak", result: "Check-in işlendiğinde hak bilgisi güncel görünür." },
  { scattered: "Dekont ve manuel kontrol", flow: "Yönetici onay akışı", result: "Ödeme ve paket talebi karar ekranına düşer." },
  { scattered: "Eğitmene ayrı bilgi verme", flow: "Günlük fizyoterapist ekranı", result: "Fizyoterapist sıradaki seansı ve danışan bilgisini görür." },
  { scattered: "Danışanın tekrar tekrar yazması", flow: "Mobil danışan görünümü", result: "Yaklaşan seans, kalan hak ve ölçüm bilgisi uygulamadadır." },
];

const featuredScreens = [
  {
    role: "Yönetici",
    title: "Operasyon görünümü",
    text: "Günlük seans, ekip yoğunluğu ve paket durumu tek yönetim ekranında okunur.",
    image: "/product-screens/admin-dashboard.png",
    fallbackImage: "/product-screens/admin-dashboard.png",
  },
  {
    role: "Fizyoterapist",
    title: "Sahada danışan dosyası",
    text: "Fizyoterapist aktif paket, katılım ve ölçüm bilgisini seans öncesinde görür.",
    image: "/product-screens/trainer-client-detail.png",
    fallbackImage: "/product-screens/trainer-home.png",
  },
  {
    role: "Check-in",
    title: "Hak düşümü",
    text: "QR veya MEM kod ile seans işlenir; kalan hak ve kayıt geçmişi güncellenir.",
    image: "/product-screens/trainer-checkin.png",
    fallbackImage: "/product-screens/trainer-checkin.png",
  },
  {
    role: "Danışan",
    title: "Kalan hak ve ölçüm",
    text: "Danışan yaklaşan seansını, paket hakkını ve gelişim kayıtlarını mobilde takip eder.",
    image: "/product-screens/member-package.png",
    fallbackImage: "/product-screens/member-home.png",
  },
];

const faqItems = [
  {
    question: "Fizyoflow kimler için geliştirilmiştir?",
    answer: "Fizyoflow; fizyoterapi klinikleri, klinik pilates hizmeti veren merkezler ve danışan seanslarını paket hakkı ile takip eden sağlık odaklı ekipler için geliştirilmiştir.",
  },
  {
    question: "Paket hakkı nasıl takip edilir?",
    answer: "Seans veya grup dersi check-in ile işlendiğinde ilgili danışanın paket hakkı güncellenir. Yönetici kalan hak, paket geçmişi ve yenileme ihtiyacını aynı sistemde görür.",
  },
  {
    question: "Fizyoterapist check-in akışı nasıl çalışır?",
    answer: "Fizyoterapist günlük seanslarını mobilde görür; QR veya manuel kod ile katılımı işler. İşlenen check-in, danışan kaydı ve paket takibiyle birlikte güncel kalır.",
  },
  {
    question: "Danışan uygulamada ne görür?",
    answer: "Danışan yaklaşan seansını, kalan paket hakkını, grup derslerini, bildirimlerini ve ölçüm geçmişini kendi mobil ekranından takip eder.",
  },
  {
    question: "Fizyoflow Google Play'de var mı?",
    answer: "Fizyoflow iPhone için App Store'da yayındadır. Google Play sürümü yakında yayınlanacak şekilde planlanmıştır.",
  },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${WEB_BASE}/#organization`,
        name: "Fizyoflow",
        url: WEB_BASE,
        logo: `${WEB_BASE}/brand/fizyoflow-og.svg`,
        description: CANONICAL_DESCRIPTION,
        sameAs: [APP_STORE_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${WEB_BASE}/#website`,
        name: "Fizyoflow",
        url: WEB_BASE,
        publisher: { "@id": `${WEB_BASE}/#organization` },
        inLanguage: "tr-TR",
        description: CANONICAL_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${WEB_BASE}/#software`,
        name: "Fizyoflow",
        applicationCategory: "BusinessApplication",
        operatingSystem: "iOS, Web",
        description: CANONICAL_DESCRIPTION,
        url: WEB_BASE,
        downloadUrl: APP_STORE_URL,
        publisher: { "@id": `${WEB_BASE}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "TRY",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "Seans takibi",
          "Paket ve kalan hak takibi",
          "Fizyoterapist check-in akışı",
          "Danışan mobil deneyimi",
          "Ölçüm geçmişi",
          "Rol bazlı erişim",
        ],
        screenshot: [
          `${WEB_BASE}/product-screens/admin-dashboard.png`,
          `${WEB_BASE}/product-screens/trainer-checkin.png`,
          `${WEB_BASE}/product-screens/member-package.png`,
        ],
        softwareHelp: `${WEB_BASE}/#demo`,
      },
      {
        "@type": "FAQPage",
        "@id": `${WEB_BASE}/#faq`,
        mainEntity: faqItems.map((item) => ({
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
        "@id": `${WEB_BASE}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Fizyoflow",
            item: WEB_BASE,
          },
        ],
      },
    ],
  };

  return (
    <main className="product-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="brand-intro" aria-hidden="true">
        <div className="brand-intro-inner">
          <img src="/brand/fizyoflow-current-mark.png" alt="" />
          <strong>Fizyoflow</strong>
          <span>Seans, paket ve danışan takibi tek akışta.</span>
        </div>
      </div>

      <header className="product-nav">
        <a className="product-brand" href="/" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <nav>
          <a href="#urun">Ürün</a>
          <MarketingLink href="#demo" eventName="demo_section_click" eventSource="header">Demo</MarketingLink>
        </nav>
      </header>

      <section className="product-hero">
        <div className="hero-beams" aria-hidden="true" />
        <div className="product-shell product-hero-grid">
          <div className="product-hero-copy">
            <p className="product-kicker">Fizyoterapi klinikleri için mobil operasyon sistemi</p>
            <h1>Fizyoterapi kliniğinizde seans, paket ve check-in takibi <span className="hero-highlight">dağılmasın</span>.</h1>
            <p className="product-lead">
              Fizyoflow; klinik sahibinin yönetim ekranını, fizyoterapistin günlük akışını ve danışanın mobil deneyimini aynı güncel kayıt üzerinde buluşturur.
            </p>
            <div className="product-store-actions" aria-label="Fizyoflow uygulama indirme bağlantıları">
              <MarketingLink
                className="store-button store-button-active"
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                eventName="app_store_click"
                eventSource="hero"
              >
                <span>App Store</span>
                <strong>iPhone için indir</strong>
              </MarketingLink>
              <span className="store-button store-button-soon" aria-disabled="true">
                <span>Google Play</span>
                <strong>Yakında</strong>
              </span>
            </div>
          </div>

          <ProductShowcase hero />
        </div>
      </section>

      <section className="product-explain-section">
        <div className="product-shell product-explain-grid">
          <div className="product-section-heading">
            <p className="product-kicker">Fizyoflow nedir?</p>
            <h2>Klinik sahibini, fizyoterapisti ve danışanı aynı güncel akışta buluşturan sistem.</h2>
            <p>
              Fizyoflow yalnızca bir takvim değildir. Başvuru, seans planı, paket hakkı, ödeme durumu, check-in,
              ölçüm geçmişi ve yenileme takibini birbirine bağlar.
            </p>
          </div>
          <div className="product-explain-cards">
            {productExplainers.map((item) => (
              <article className="product-explain-card" key={item.role}>
                <span>{item.role}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ComparisonSection />

      <OperationalFlowSection />

      <section id="urun" className="product-screens-section">
        <div className="product-shell">
          <div className="product-section-heading">
            <p className="product-kicker">Gerçek ürün ekranları</p>
            <h2>Önce en kritik akışlar, sonra tüm ürün ekranları.</h2>
            <p>Yönetici operasyonu takip eder, fizyoterapist seansı işler, danışan kendi sürecini uygulamada görür.</p>
          </div>

          <FeaturedScreens />

          <TrackedGallery className="role-screen-gallery">
            {screenGroups.map((group, groupIndex) => (
              <section className="role-screen-group" key={group.role} aria-label={`${group.role} ekranları`}>
                <div className="role-screen-heading">
                  <span>{group.role}</span>
                  <p>{group.summary}</p>
                </div>
                <div className="role-screen-row">
                  {group.screens.map((screen, index) => (
                    <article className="screen-item" key={`${group.role}-${screen.label}`}>
                      <div className="iphone iphone-gallery">
                        <div className="iphone-island" />
                        <ProductScreenImage
                          src={screen.image}
                          fallbackSrc={group.fallbackImage}
                          alt={`Fizyoflow ${group.role} rolünde ${screen.label} ekranı: ${screen.detail}`}
                          priority={groupIndex === 0 && index === 0}
                        />
                      </div>
                      <div className="screen-caption">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div><h3>{screen.label}</h3><p>{screen.detail}</p></div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </TrackedGallery>
        </div>
      </section>

      <section className="product-trust-section">
        <div className="product-shell trust-panel">
          <div className="trust-copy">
            <p className="product-kicker">Güven ve kontrol</p>
            <h2>Kontrol, herkesin her şeyi görmesi değil; doğru kişinin doğru bilgiye erişmesidir.</h2>
            <p>Fizyoflow, klinik içindeki erişimi kullanıcı rolüne göre ayırır ve danışan sürecini dağınık hesaplar yerine düzenli kayıtlarla yürütür.</p>
          </div>
          <div className="trust-grid">
            {trustItems.map((item, index) => (
              <article className="trust-card" key={item.title}>
                <div className="trust-card-meta">
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <small>{item.label}</small>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-faq-section">
        <div className="product-shell product-faq-grid">
          <div className="product-section-heading">
            <p className="product-kicker">Sık sorulanlar</p>
            <h2>Fizyoflow’u arayan kişinin hızlıca cevap bulacağı kısa ürün özeti.</h2>
            <p>{CANONICAL_DESCRIPTION}</p>
          </div>
          <MarketingFaqList items={faqItems} />
        </div>
      </section>

      <section id="demo" className="product-demo-section">
        <div className="product-shell product-demo-grid">
          <div className="product-demo-copy">
            <img src="/brand/fizyoflow-current-mark.png" alt="" />
            <p className="product-kicker">Kısa bir görüşmeyle başlayın</p>
            <h2>15 dakikada seans, paket ve check-in takibinin nerede koptuğunu birlikte çıkaralım.</h2>
            <p>Klinik akışınızı birlikte açarız: hangi takip WhatsApp’ta kalıyor, paket hakkı nerede kopuyor, check-in ve danışan bilgilendirmesi nasıl sadeleşir netleştiririz.</p>
          </div>
          <DemoLeadForm compact />
        </div>
      </section>

      <footer className="product-footer">
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

function ComparisonSection() {
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
            {comparisonItems.map((item) => (
              <p key={item.scattered}>
                <strong>{item.scattered}</strong>
                <small>Kontrol kişiye ve mesaja bağlı kalır.</small>
              </p>
            ))}
          </div>
          <div className="comparison-divider" aria-hidden="true">
            {comparisonItems.map((item, index) => <span key={`${item.flow}-${index}`} />)}
          </div>
          <div className="comparison-column comparison-column-flow">
            <span>Fizyoflow akışı</span>
            {comparisonItems.map((item) => (
              <p key={item.flow}>
                <strong>{item.flow}</strong>
                <small>{item.result}</small>
              </p>
            ))}
          </div>
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
          <div className="iphone featured-screen-phone" aria-hidden="true">
            <ProductScreenImage
              src={screen.image}
              fallbackSrc={screen.fallbackImage}
              alt=""
              priority={false}
            />
          </div>
          <div>
            <span>{screen.role}</span>
            <h3>{screen.title}</h3>
            <p>{screen.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function OperationalFlowSection() {
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
            <span className="operational-role">Yönetici</span>
            <span className="operational-role">Fizyoterapist</span>
            <span className="operational-role">Danışan</span>
          </div>
          <div className="operational-flow-core">
            <img src="/brand/fizyoflow-current-mark.png" alt="" />
            <strong>Fizyoflow</strong>
          </div>
          <div className="operational-flow-results">
            {[
              "Takvim",
              "Paketler",
              "Check-in",
              "Danışanlar",
              "Ölçümler",
              "Grup dersleri",
              "Gelir takibi",
            ].map((feature) => <span className="operational-feature" key={feature}>{feature}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
