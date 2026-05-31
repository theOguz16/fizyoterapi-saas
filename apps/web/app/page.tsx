import { DemoLeadForm } from "../components/demo-lead-form";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.fizyoflow.com";

const productPillars = [
  {
    icon: "calendar",
    title: "Klinik akışı tek merkezde",
    body: "Randevu, paket, üye, eğitmen ve ölçüm takibi kliniğin günlük ritmine göre sadeleşir.",
  },
  {
    icon: "mobile",
    title: "Üye deneyimi mobilde tamamlanır",
    body: "Danışanlar randevu, paket, hatırlatma ve gelişim takibini mobil uygulamada anlaşılır biçimde görür.",
  },
  {
    icon: "search",
    title: "Dijital vitrin yayına hazır gelir",
    body: "Aktif klinikler için SEO, Maps, lead form ve paylaşılabilir public sayfa Fizyoflow ekibiyle hazırlanır.",
  },
];

const managedServices = [
  "Google Maps ve Business Profile yönlendirme kontrolü",
  "Lokasyon ve hizmet odaklı SEO title, açıklama ve sayfa metni",
  "WhatsApp, telefon, harita ve bilgi formu tıklama ölçümü",
  "Klinik galeri, hizmet listesi, çalışma alanı ve kampanya vitrin düzeni",
  "Yorum isteme linki, Instagram bio metni ve WhatsApp karşılama şablonu",
  "Aylık vitrin sağlık kontrolü ve iyileştirme önerileri",
];

const brandSystem = [
  {
    title: "Sakin klinik dili",
    body: "Acele ettirmeyen, güven veren ve danışanın ihtiyacını ilk ekranda anlayan kısa mesajlar.",
  },
  {
    title: "Mobil ürünle aynı his",
    body: "Kartlar, yumuşak yeşil tonlar, operasyon ritmi ve ekran dili web vitriniyle birlikte çalışır.",
  },
  {
    title: "Premium ama anlaşılır",
    body: "Klinik sahibinin gururla paylaşacağı; danışanın da kolayca aksiyon alacağı temiz bir yapı.",
  },
];

const proofMetrics = [
  { value: "Mobil", label: "Klinik içi düzen" },
  { value: "Web", label: "Google'a açık vitrin" },
  { value: "Lead", label: "WhatsApp, telefon, harita" },
];

const heroScreens = [
  {
    role: "Yönetici",
    title: "Yönetim merkezi",
    src: "/product-screens/admin-dashboard.png",
    alt: "Fizyoflow mobil uygulamasında yönetim merkezi ekranı",
  },
  {
    role: "Takvim",
    title: "Salon takvimi",
    src: "/product-screens/admin-calendar.png",
    alt: "Fizyoflow mobil uygulamasında salon takvimi ekranı",
  },
  {
    role: "Ekip",
    title: "Üye ve eğitmen takibi",
    src: "/product-screens/admin-members.png",
    alt: "Fizyoflow mobil uygulamasında üyeler ve eğitmenler ekranı",
  },
];

const workflowSteps = [
  "Randevu",
  "Paket",
  "Eğitmen",
  "Üye",
  "Ölçüm",
  "Public vitrin",
];

const appMoments = [
  {
    eyebrow: "Admin App",
    title: "Yönetim merkezi",
    subtitle: "Aktif üye, risk, bugünkü ders ve operasyon sinyalleri.",
    image: "/product-screens/admin-dashboard.png",
    alt: "Yönetim merkezi mobil ekran görüntüsü",
    stats: [
      ["Aktif üye", "128"],
      ["Bugünkü ders", "18"],
    ],
    focus: ["Bekleyen onay", "Riskli üye", "Salon QR"],
  },
  {
    eyebrow: "Klinik Takvimi",
    title: "Salon Takvimi",
    subtitle: "Haftalık ders akışı, gün seçimi ve seans planı aynı sakin ekranda.",
    image: "/product-screens/admin-calendar.png",
    alt: "Salon takvimi mobil ekran görüntüsü",
    stats: [
      ["Hafta", "20-26"],
      ["Ders", "0"],
    ],
    focus: ["Gün seçimi", "Saat blokları", "Ders yoğunluğu"],
  },
  {
    eyebrow: "Ekip ve Üye",
    title: "Kişi yönetimi",
    subtitle: "Üye, eğitmen, durum ve kayıt bilgileri hızlı aksiyona dönüşür.",
    image: "/product-screens/admin-members.png",
    alt: "Üye ve eğitmen listesi mobil ekran görüntüsü",
    stats: [
      ["Rol", "2"],
      ["Durum", "Aktif"],
    ],
    focus: ["Rol filtreleri", "Detay aksiyonu", "Kayıt bilgisi"],
  },
];

const integrationFlow = [
  {
    step: "01",
    title: "Klinik bilgileri alınır",
    body: "Mobil veya admin akışında adres, WhatsApp, Maps linki, hizmetler ve galeri bilgileri toplanır.",
  },
  {
    step: "02",
    title: "Fizyoflow yayına hazırlar",
    body: "SEO başlığı, kısa hizmet metinleri, CTA düzeni ve LocalBusiness verisi kontrollü üretilir.",
  },
  {
    step: "03",
    title: "Subdomain yayına çıkar",
    body: "Klinik sayfası Google'a açık, paylaşılabilir ve WhatsApp/telefon/harita aksiyonları ölçülebilir olur.",
  },
];

const growthHighlights = [
  "Kadıköy fizyoterapi aramalarına uygun doğal sayfa metni",
  "WhatsApp, telefon ve harita tıklamalarında ölçülebilir lead akışı",
  "Google Business profiline eklenebilir profesyonel klinik subdomain'i",
  "Klinik hizmetlerini anlatan paylaşılabilir sosyal medya metinleri",
  "Maps, adres, telefon ve çalışma saatlerinde güven veren tutarlılık",
];

const launchReadiness = [
  "Gerçek pilot klinik içerikleri ve fotoğrafları",
  "Wildcard DNS, SSL ve reserved subdomain kontrolü",
  "Lead form, WhatsApp, telefon ve harita event ölçümü",
  "Open Graph görseli, canonical, sitemap ve JSON-LD",
];

const pilotCards = [
  {
    title: "Pilot hazırlık",
    body: "Klinik bilgileri, lokasyon, hizmetler, görseller ve iletişim kanalları netleşmeden vitrin yayına alınmaz.",
  },
  {
    title: "Kontrollü yayın",
    body: "Subdomain, SSL, sitemap, canonical ve legal linkler doğrulandıktan sonra klinik sayfası paylaşılır.",
  },
  {
    title: "İlk ölçüm",
    body: "WhatsApp, telefon, harita, form ve sayfa görüntüleme eventleriyle ilk talep akışı takip edilir.",
  },
];

const storyBeats = [
  {
    title: "Mobil uygulama",
    body: "Randevu, paket, eğitmen, üye ve ölçüm takibi tek yerde.",
  },
  {
    title: "Public klinik sayfası",
    body: "Her klinik için paylaşılabilir, güven veren dijital vitrin.",
  },
  {
    title: "SEO + Maps desteği",
    body: "Google araması, Maps, WhatsApp ve telefon tıklamaları ölçülür.",
  },
];

const audienceCards = [
  {
    title: "Fizyoterapi klinikleri",
    problem: "Randevu, paket ve danışan takibi farklı yerlerde dağılır.",
    body: "Klinik akışı mobilde düzenlenir; public vitrin aynı çizgide güven veren ilk temas alanı olur.",
    result: "Daha az manuel takip, daha net danışan deneyimi.",
  },
  {
    title: "Klinik pilates stüdyoları",
    problem: "Paket hakkı, grup dersleri ve eğitmen yoğunluğu hızlıca karmaşıklaşır.",
    body: "Üye, eğitmen, paket ve grup dersi akışı tek ürün dilinde görünür hale gelir.",
    result: "Devamlılık, yenileme ve ekip koordinasyonu daha takip edilebilir olur.",
  },
  {
    title: "Rehabilitasyon ve hareket merkezleri",
    problem: "Danışan ilk temasta hizmeti, konumu ve doğru iletişim yolunu anlamakta zorlanır.",
    body: "Hizmet anlatımı, lokasyon, harita, WhatsApp ve form tek klinik vitrini içinde birleşir.",
    result: "İlk temas daha güvenli, paylaşılabilir ve ölçülebilir hale gelir.",
  },
];

const conversionMoments = [
  {
    problem: "Klinikte bilgi dağınık kalır",
    action: "Randevu, paket, üye, eğitmen ve ölçüm tek mobil akışta toplanır.",
    result: "Ekip neye bakacağını, danışan ne bekleyeceğini daha hızlı görür.",
  },
  {
    problem: "Instagram ve Google trafiği kararsız kalır",
    action: "Her klinik için lokasyon, hizmet, harita ve WhatsApp CTA'sı olan public vitrin hazırlanır.",
    result: "Ziyaretçi karar anında doğru aksiyona yönlenir.",
  },
  {
    problem: "Lead geliyor ama kaynak görünmez",
    action: "WhatsApp, telefon, harita, form ve sayfa görüntüleme eventleri klinik bazlı izlenir.",
    result: "Klinik hangi kanalın çalıştığını görüp büyüme kararını daha net verir.",
  },
];

const packageCards = [
  {
    title: "Pilot Klinik",
    fit: "İlk vitrini ve mobil operasyonu kontrollü başlatmak isteyen klinikler.",
    includes: ["Kurulum görüşmesi", "Public klinik vitrini", "Temel lead ölçümü"],
    note: "Kurulum destekli başlangıç",
  },
  {
    title: "Büyüme Paketi",
    fit: "Randevu, paket, ekip ve web görünürlüğünü birlikte büyütmek isteyen işletmeler.",
    includes: ["Mobil operasyon", "SEO + Maps kontrolü", "WhatsApp/telefon/harita eventleri"],
    note: "Klinik kapsamına göre teklif",
  },
  {
    title: "Çoklu Ekip",
    fit: "Birden fazla eğitmen, hizmet veya yoğun danışan trafiği olan merkezler.",
    includes: ["Ekip ve üye takibi", "Gelişmiş vitrin bakımı", "Büyüme raporu"],
    note: "Özel planlama",
  },
];

const roiCards = [
  ["Ziyaret", "Google, Instagram ve paylaşılan subdomain trafiği görünür olur."],
  ["Aksiyon", "WhatsApp, telefon, harita ve form tıklamaları ayrı kaynaklarla izlenir."],
  ["Lead", "Klinik hangi hizmet ve CTA'nın talep ürettiğini daha net görür."],
];

const deliveryItems = [
  {
    title: "Kurulum görüşmesi",
    body: "Kliniğin hizmetleri, lokasyonu, hedef danışan profili, görselleri ve iletişim kanalları netleştirilir.",
  },
  {
    title: "Vitrin üretimi",
    body: "Metin, görsel sıralama, CTA düzeni, SEO bilgileri ve LocalBusiness yapısı Fizyoflow diliyle hazırlanır.",
  },
  {
    title: "Yayın ve ölçüm",
    body: "Subdomain yayına alınır; form, WhatsApp, telefon ve harita aksiyonları klinik bazlı takip edilir.",
  },
  {
    title: "Büyüme bakımı",
    body: "Maps tutarlılığı, yorum linki, paylaşım metinleri ve vitrin sağlığı periyodik olarak gözden geçirilir.",
  },
];

const intakeSteps = [
  {
    title: "Klinik kimliği",
    body: "Klinik adı, slug tercihi, kısa açıklama, logo, kapak görseli ve marka rengi alınır.",
  },
  {
    title: "İletişim ve lokasyon",
    body: "Adres, telefon, WhatsApp, çalışma saatleri, Google Maps ve Business Profile bağlantıları eklenir.",
  },
  {
    title: "Hizmet ve uzmanlık",
    body: "Fizyoterapi, klinik pilates, sporcu rehabilitasyonu gibi hizmetler kısa açıklamalarla seçilir.",
  },
  {
    title: "Yayın onayı",
    body: "Fizyoflow metni ve görsel düzeni hazırlar; klinik sahibi son önizlemeyi onaylar.",
  },
];

const intakeFields = [
  "Klinik adı ve tercih edilen URL",
  "Adres, telefon, WhatsApp ve çalışma saatleri",
  "Google Maps / Business Profile linki",
  "Hizmet başlıkları ve kısa açıklamalar",
  "Klinik fotoğrafları, logo ve sosyal medya linkleri",
  "Yorum isteme linki ve öne çıkarılacak kampanya",
];

const launchSignals = [
  "Klinik adı, adresi, telefon numarası ve çalışma saatleri tutarlı",
  "Hizmetler kısa, anlaşılır ve lokasyonla birlikte anlatılmış",
  "WhatsApp, telefon, harita ve form CTA'ları ilk ekranda görünür",
  "SEO title, description, canonical, Open Graph ve JSON-LD hazır",
];

const faqItems = [
  {
    question: "Bu sadece bir web sitesi mi?",
    answer: "Hayır. Fizyoflow; klinik operasyonu, mobil üye deneyimi, public vitrin, SEO, Maps yönlendirmesi ve lead takibini aynı altyapıda birleştirir.",
  },
  {
    question: "Klinik sayfasını kim hazırlar?",
    answer: "Temel bilgileri klinikten alırız; SEO metni, Maps tutarlılığı, hizmet anlatımı, görsel düzen ve yayın kalitesini Fizyoflow ekibi yönetir.",
  },
  {
    question: "Subdomain nasıl çalışır?",
    answer: "Her klinik kendi URL koduyla örneğin atlasfizyo.fizyoflow.com adresinde yayınlanır. Sayfa klinik profilinden beslenir ve Fizyoflow çatısı altında güvenli biçimde sunulur.",
  },
  {
    question: "Google'da hemen üst sıraya çıkarır mı?",
    answer: "Hiçbir SEO çalışması anlık sıralama garantisi vermez. Fizyoflow; doğru teknik yapı, yerel SEO metni, Maps tutarlılığı ve ölçülebilir CTA akışıyla kliniğin görünürlük temelini güçlendirir.",
  },
  {
    question: "Klinik sahibi içerikleri kendisi bozabilir mi?",
    answer: "Managed Growth modelinde kritik SEO ve yayın alanları Fizyoflow ekibi tarafından korunur. Klinik sahibi temel bilgileri sağlar; yayın kalitesi kontrollü ilerler.",
  },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Fizyoflow",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "Fizyoflow, fizyoterapi klinikleri için operasyon, mobil uygulama, dijital vitrin, SEO ve lead toplama altyapısını birleştirir.",
    url: "https://fizyoflow.com",
    offers: {
      "@type": "Offer",
      category: "SaaS",
      availability: "https://schema.org/InStock",
    },
    publisher: {
      "@type": "Organization",
      name: "Fizyoflow",
      url: "https://fizyoflow.com",
    },
  };
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Fizyoflow",
    url: "https://fizyoflow.com",
    logo: "https://fizyoflow.com/brand/fizyoflow-logo.svg",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      areaServed: "TR",
      availableLanguage: ["tr"],
    },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <header className="site-nav">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/brand/fizyoflow-mark.svg" alt="" /></span>
          <span>Fizyoflow</span>
        </a>
        <nav>
          <a href="#platform">Platform</a>
          <a href="#vitrine">Vitrin</a>
          <a href="#growth">Büyüme</a>
          <a href="#demo">Demo</a>
          <a className="nav-button" href={`${APP_URL}/login`}>Giriş Yap</a>
        </nav>
      </header>

      <section className="home-hero">
        <div className="container home-hero-grid">
          <div className="hero-content">
            <p className="eyebrow">Fizyoterapi ve klinik pilates merkezleri için</p>
            <h1>Kliniğinizin düzeni mobilde, vitrini web'de akar.</h1>
            <p className="lead">
              Randevu, paket, üye, eğitmen ve ölçüm takibi mobilde düzenlenir. Kliniğiniz ise SEO uyumlu,
              paylaşılabilir ve WhatsApp lead akışına hazır public vitrinle Google'da daha güven veren görünürlük kazanır.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#demo">Demo Talep Et</a>
              <a className="secondary-action" href="/ornek-klinik">Klinik Sayfasını Gör</a>
            </div>
            <div className="startup-proof" aria-label="Fizyoflow ürün özeti">
              {[
                ["Mobil uygulama", "Bugünün dersi, riskli üye, ekip"],
                ["Klinik vitrini", "klinikadi.fizyoflow.com"],
                ["Büyüme takibi", "WhatsApp, telefon, harita"],
              ].map(([title, body]) => (
                <div className="proof-item" key={title}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              ))}
            </div>
            <div className="founder-note reveal-up delay-2">
              <span>Fizyoflow hissi</span>
              <strong>Kliniğin iç düzeniyle dış dünyadaki görünürlüğü aynı dilde buluşur.</strong>
            </div>
          </div>

          <aside className="startup-stage reveal-up delay-2" aria-label="Fizyoflow ürün görseli">
            <div className="stage-photo">
              <img src="/product-screens/fizyoflow-pilates-iphone-hero.png" alt="Fizyoflow mobil uygulaması ve klinik pilates deneyimi" />
            </div>
            <div className="stage-product-card">
              <div className="stage-phone stage-phone-main">
                <div className="phone-speaker" />
                <div className="phone-screen screenshot-screen">
                  <img src="/product-screens/admin-dashboard.png" alt="Fizyoflow yönetim merkezi" width="1206" height="2622" fetchPriority="high" />
                </div>
              </div>
              <div className="stage-phone stage-phone-side">
                <div className="phone-speaker" />
                <div className="phone-screen screenshot-screen">
                  <img src="/product-screens/admin-calendar.png" alt="Fizyoflow salon takvimi" width="1206" height="2622" loading="lazy" />
                </div>
              </div>
              <div className="live-card live-card-one">
                <span>Bugünün odağı</span>
                <strong>Riskli üye 3</strong>
              </div>
              <div className="live-card live-card-two">
                <span>Yeni lead</span>
                <strong>WhatsApp + Maps</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="motion-band" aria-label="Fizyoflow platform akışı">
        <div className="motion-track">
          {[...workflowSteps, ...workflowSteps].map((step, index) => (
            <span key={`${step}-${index}`}>{step}</span>
          ))}
        </div>
      </section>

      <section id="platform" className="section-band platform-band">
        <div className="container platform-grid">
          <div className="section-heading">
            <p className="eyebrow">Platform</p>
            <h2>Klinik akışını dağıtmadan büyüten üçlü yapı.</h2>
          </div>
          <div className="platform-cards">
            {[
              ["01", "Mobil kontrol", "Randevu, paket, üye, eğitmen ve ölçüm tek ritimde."],
              ["02", "Dijital vitrin", "Her klinik için güven veren public sayfa ve hızlı CTA."],
              ["03", "Büyüme ölçümü", "WhatsApp, telefon, harita ve form dönüşleri görünür."],
            ].map(([number, title, body]) => (
              <article className="platform-card" key={title}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band conversion-band">
        <div className="container section-heading">
          <p className="eyebrow">Satın alma nedeni</p>
          <h2>Klinik sahibinin kararını hızlandıran şey özellik listesi değil, görünür sonuçtur.</h2>
        </div>
        <div className="container conversion-grid">
          {conversionMoments.map((item, index) => (
            <article className="conversion-card" key={item.problem}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.problem}</h3>
              <p>{item.action}</p>
              <strong>{item.result}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band pricing-band">
        <div className="container section-heading">
          <p className="eyebrow">Paket beklentisi</p>
          <h2>Net fiyat yerine önce klinik kapsamını netleştirir, doğru başlangıç planını çıkarırız.</h2>
        </div>
        <div className="container pricing-grid">
          {packageCards.map((card) => (
            <article className="pricing-card" key={card.title}>
              <span>{card.note}</span>
              <h3>{card.title}</h3>
              <p>{card.fit}</p>
              <ul>
                {card.includes.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <a href="#demo">Bu planı konuşalım</a>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band app-showcase-band">
        <div className="container section-heading center-heading">
          <p className="eyebrow">Mobil ürün</p>
          <h2>Günlük klinik yönetimi sade, hızlı ve görsel.</h2>
        </div>
        <div className="container app-slider" aria-label="Fizyoflow mobil ekran slider">
          {appMoments.map((screen, index) => (
            <article className="app-slide" key={screen.title}>
              <div className="slide-copy">
                <p className="eyebrow">{screen.eyebrow}</p>
                <h3>{screen.title}</h3>
                <p>{index === 0 ? "Risk, onay, ders ve ekip sinyalleri ilk bakışta." : index === 1 ? "Haftalık ders akışı temiz bir takvimde." : "Üye ve eğitmen takibi hızlı aksiyona döner."}</p>
              </div>
              <div className={`phone-frame phone-frame-${index + 1}`}>
                <div className="phone-speaker" />
                <div className="phone-screen app-screen screenshot-screen">
                  <img src={screen.image} alt={screen.alt} width="1206" height="2622" loading="lazy" />
                </div>
              </div>
              <div className="slide-points" aria-label={`${screen.title} öne çıkanlar`}>
                {screen.focus.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band integration-band">
        <div className="container section-heading">
          <p className="eyebrow">Managed Growth</p>
          <h2>Klinik bilgi verir, Fizyoflow vitrini yayına hazırlar.</h2>
        </div>
        <div className="container integration-flow">
          {integrationFlow.map((item) => (
            <article className="integration-card" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="vitrine" className="section-band showcase-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Dijital Vitrin</p>
            <h2>Her klinik için premium public sayfa.</h2>
            <p>
              Hizmetler, konum, WhatsApp, telefon ve Maps tek temiz adreste birleşir:
              klinikadi.fizyoflow.com.
            </p>
            <div className="vitrine-points">
              <span>SEO başlığı</span>
              <span>Maps bağlantısı</span>
              <span>WhatsApp CTA</span>
              <span>Lead ölçümü</span>
            </div>
          </div>
          <div className="mini-browser">
            <div className="mini-browser-bar">atlasfizyo.fizyoflow.com</div>
            <div className="mini-browser-hero">
              <p>Kadıköy · Klinik Pilates · Fizyoterapi</p>
              <h3>Atlas Fizyo</h3>
              <span>WhatsApp ile Bilgi Al</span>
            </div>
            <div className="mini-browser-cards">
              <span>SEO hazır</span>
              <span>Maps hazır</span>
              <span>Lead form hazır</span>
            </div>
          </div>
        </div>
      </section>

      <section id="growth" className="section-band muted-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">SEO + Maps + Pazarlama</p>
            <h2>Google'da görünmek için teknik temel hazır.</h2>
            <p>
              Yerel arama dili, Maps tutarlılığı, LocalBusiness verisi ve CTA ölçümü aynı akışta kurulur.
            </p>
          </div>
          <div className="checklist">
            {managedServices.slice(0, 5).map((item) => (
              <div className="check-row" key={item}>
                <span aria-hidden="true">✓</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band roi-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Büyüme ölçümü</p>
            <h2>Lead kaynağı tahmin değil, takip edilen bir akış olur.</h2>
            <p>
              Fizyoflow vitrini sadece sayfa yayına almakla kalmaz; ziyaretin hangi aksiyona döndüğünü,
              hangi hizmetin ilgi çektiğini ve hangi kanalın talep ürettiğini görünür kılar.
            </p>
          </div>
          <div className="roi-stack">
            {roiCards.map(([title, body], index) => (
              <article className="roi-card" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band audience-band">
        <div className="container section-heading">
          <p className="eyebrow">Kimler için?</p>
          <h2>Fizyoterapi, klinik pilates ve rehabilitasyon merkezleri için lokasyon odaklı büyüme altyapısı.</h2>
        </div>
        <div className="container audience-grid">
          {audienceCards.map((card) => (
            <article className="audience-card" key={card.title}>
              <h3>{card.title}</h3>
              <span>{card.problem}</span>
              <p>{card.body}</p>
              <strong>{card.result}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band local-seo-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Yerel SEO sinyalleri</p>
            <h2>Danışanın aradığı hizmeti, bölgeyi ve iletişim yolunu aynı sayfada anlatır.</h2>
            <p>
              Klinik vitrini; Kadıköy fizyoterapi, klinik pilates, sporcu rehabilitasyonu ve benzeri uzun kuyruklu arama niyetleri için
              hizmet, konum ve güven bilgisini birlikte taşır.
            </p>
          </div>
          <div className="checklist">
            {growthHighlights.map((item) => (
              <div className="check-row" key={item}>
                <span aria-hidden="true">✓</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band delivery-band">
        <div className="container section-heading">
          <p className="eyebrow">Yayın akışı</p>
          <h2>Web sitesi tek seferlik tasarım değil, klinik büyüme sürecinin ölçülen parçası olur.</h2>
        </div>
        <div className="container delivery-timeline">
          {deliveryItems.map((item, index) => (
            <article className="delivery-step" key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band intake-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Kurulum bilgileri</p>
            <h2>Vitrin yayına çıkmadan önce kritik klinik bilgileri tek akışta toplanır.</h2>
            <p>
              Fizyoflow, klinik sahibinin içerik yükünü azaltır; ama yayın kalitesini korumak için kimlik,
              lokasyon, hizmet ve iletişim alanlarını kontrol ederek ilerler.
            </p>
            <div className="intake-field-list">
              {intakeFields.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="intake-preview" aria-label="Klinik vitrin kurulum önizlemesi">
            <div className="intake-device">
              <div className="intake-progress"><span style={{ ["--progress" as string]: "82%" }} /></div>
              <p className="intake-kicker">Yayın hazırlığı</p>
              <h3>Klinik vitrini</h3>
              {intakeSteps.slice(0, 3).map((item, index) => (
                <div className={`intake-row ${index === 1 ? "active" : ""}`} key={item.title}>
                  <span>{index + 1}</span>
                  <p>{item.title}</p>
                </div>
              ))}
              <div className="intake-mini-form">
                <label>SEO başlığı <strong>Lokasyon + hizmet + klinik adı</strong></label>
                <label>CTA düzeni <strong>WhatsApp, telefon, harita, form</strong></label>
              </div>
            </div>
          </div>
        </div>
        <div className="container intake-steps">
          {intakeSteps.map((item, index) => (
            <article className="intake-step" key={item.title}>
              <span>{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band launch-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Canlıya hazır mı?</p>
            <h2>Pilot klinik yayını için teknik ve içerik sinyalleri birlikte kontrol edilir.</h2>
            <p>
              Yayın öncesi hedef sadece sayfanın açılması değil; doğru klinik bilgisinin, güven veren metnin,
              ölçülebilir lead akışının ve arama motoru sinyallerinin birlikte hazır olmasıdır.
            </p>
            <div className="platform-cards">
              {pilotCards.map((card, index) => (
                <article className="platform-card" key={card.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="launch-readiness">
            {[...launchSignals, ...launchReadiness].map((item, index) => (
              <div className="launch-ready-row" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="section-band">
        <div className="container demo-panel">
          <div>
            <p className="eyebrow">Demo</p>
            <h2>Kliniğiniz için ilk büyüme planını çıkaralım.</h2>
            <p>15 dakikalık görüşme. Net kurulum planı. İlk vitrin taslağı.</p>
            <div className="demo-badges">
              <span>Mobil akış</span>
              <span>Public vitrin</span>
              <span>SEO + Maps</span>
            </div>
          </div>
          <DemoLeadForm />
        </div>
      </section>

      <section className="section-band muted-band">
        <div className="container section-heading">
          <p className="eyebrow">Sık sorulanlar</p>
          <h2>Klinik vitrini ve Fizyoflow büyüme modeli hakkında net cevaplar.</h2>
        </div>
        <div className="container faq-grid">
          {faqItems.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>Fizyoflow</span>
          <nav>
            <a href="/gizlilik-politikasi">Gizlilik</a>
            <a href="/privacy-policy">Privacy</a>
            <a href="/hesap-silme">Hesap Silme</a>
            <a href="/kvkk">KVKK</a>
            <a href="/cerez-politikasi">Çerezler</a>
            <a href="/kullanim-sartlari">Kullanım Şartları</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
