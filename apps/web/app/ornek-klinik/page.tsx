import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atlas Fizyo Kadıköy | Fizyoterapi ve Klinik Pilates Örnek Vitrini",
  description: "Kadıköy'de fizyoterapi, klinik pilates ve sporcu rehabilitasyonu için Fizyoflow ile hazırlanmış örnek klinik vitrini.",
  alternates: { canonical: "/ornek-klinik" },
  openGraph: {
    title: "Atlas Fizyo Kadıköy | Fizyoflow Örnek Klinik Vitrini",
    description: "SEO, Maps, lead toplama ve güven veren klinik anlatımının Fizyoflow içindeki örnek görünümü.",
    url: "/ornek-klinik",
    siteName: "Fizyoflow",
    type: "website",
    images: [
      {
        url: "/brand/fizyoflow-og.svg",
        width: 1200,
        height: 630,
        alt: "Fizyoflow örnek klinik vitrini",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atlas Fizyo Kadıköy | Fizyoflow Örnek Klinik Vitrini",
    description: "SEO, Maps, lead toplama ve güven veren klinik anlatımı.",
    images: ["/brand/fizyoflow-og.svg"],
  },
};

const services = [
  {
    title: "Fizyoterapi Değerlendirme",
    desc: "Ağrı, postür ve hareket kapasitesi için başlangıç değerlendirmesi.",
    price: "Bilgi alın",
  },
  {
    title: "Klinik Pilates",
    desc: "Uzman eşliğinde kontrollü core, nefes ve duruş çalışmaları.",
    price: "Başlangıç paketi",
  },
  {
    title: "Sporcu Rehabilitasyonu",
    desc: "Sakatlık sonrası güvenli dönüş ve performans odaklı takip.",
    price: "Programlı takip",
  },
];

const trustSignals = [
  "Google Maps bilgileri tutarlı gösterilir",
  "WhatsApp, telefon ve form tıklamaları ölçülür",
  "Hizmetler lokasyon ve ihtiyaç diliyle anlatılır",
];

const gallery = [
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1597764699517-22a9dbb68eaa?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?auto=format&fit=crop&w=900&q=82",
];

const journey = [
  { title: "İlk temas", body: "Ziyaretçi WhatsApp, telefon veya form ile hızlıca kliniğe ulaşır." },
  { title: "Beden okuması", body: "Klinik dili ağrıyı, hareketi ve hedefi anlaşılır bir plana dönüştürür." },
  { title: "Güven sinyali", body: "Lokasyon, hizmetler, galeri ve Maps bilgileri aynı sayfada görünür." },
  { title: "Takip", body: "Lead ve CTA hareketleri Fizyoflow panelinde ölçülebilir hale gelir." },
];

const campaignCards = [
  { title: "Google yorum linki", body: "Memnun danışandan yorum istemek için kısa ve doğal paylaşım metni." },
  { title: "WhatsApp karşılama", body: "Yeni danışan adayına hızlı dönüş yapmak için sıcak, profesyonel mesaj şablonu." },
  { title: "Sosyal medya kullanımı", body: "Instagram bio, hikaye ve kampanya paylaşımı için vitrini destekleyen metinler." },
];

const movementPrinciples = [
  {
    title: "Ağrıyı dinlemek",
    body: "İlk mesajda bile danışana acele ettirmeyen, açık ve güvenli bir klinik dili kurulur.",
  },
  {
    title: "Hareketi tarif etmek",
    body: "Hizmetler sadece başlık olarak değil, kişinin neden ihtiyaç duyacağını anlatan kısa metinlerle sunulur.",
  },
  {
    title: "İlerlemeyi görünür kılmak",
    body: "Seans, ölçüm ve iletişim adımları kliniğin profesyonel ritmini dışarıdan da hissettirir.",
  },
];

const clinicHighlights = [
  { label: "Odak", value: "Ağrı, postür, hareket ve sürdürülebilir güç" },
  { label: "Bölge", value: "Moda, Kadıköy, Acıbadem ve çevresi" },
  { label: "İletişim", value: "WhatsApp, telefon, harita ve bilgi formu" },
];

export default function SampleClinicPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Atlas Fizyo",
    description: "Kadıköy'de fizyoterapi, klinik pilates ve sporcu rehabilitasyonu hizmetleri sunan örnek Fizyoflow vitrini.",
    url: "https://atlasfizyo.fizyoflow.com",
    telephone: "+905555555555",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Moda, Kadıköy",
      addressLocality: "Kadıköy, İstanbul",
      addressCountry: "TR",
    },
    areaServed: ["Kadıköy", "Moda", "Acıbadem"],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="clinic-hero" style={{ ["--clinic-color" as string]: "#0f8f87" }}>
        <img
          className="hero-photo"
          src="https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1800&q=82"
          alt="Örnek fizyoterapi kliniği"
        />
        <div className="clinic-hero-overlay" />
        <div className="container clinic-hero-content">
          <a className="brand on-hero" href="/">
            <span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span>
            <span>Fizyoflow</span>
          </a>
          <p className="eyebrow">Fizyoterapi Kliniği · Kadıköy · İstanbul</p>
          <h1>Atlas Fizyo</h1>
          <p className="lead">
            Kadıköy&apos;de fizyoterapi, klinik pilates ve sporcu rehabilitasyonu için güven veren; ilk temastan düzenli
            takibe kadar kliniğin profesyonel ritmini anlatan örnek dijital klinik vitrini.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#lead">WhatsApp ile Bilgi Al</a>
            <a className="secondary-action" href="#services">Hizmetleri İncele</a>
          </div>
          <div className="clinic-hero-facts">
            <span>4.9 Google puanı</span>
            <span>Moda, Kadıköy</span>
            <span>Aynı gün dönüş</span>
          </div>
          <div className="clinic-product-orbit" aria-label="Fizyoflow ürün ve büyüme akışı">
            <div className="orbit-phone">
              <div className="phone-speaker" />
              <div className="phone-screen screenshot-screen">
                <img src="/product-screens/admin-dashboard.png" alt="Fizyoflow yönetim merkezi" width="1206" height="2622" />
              </div>
            </div>
            <div className="orbit-card orbit-card-seo">
              <span>SEO</span>
              <strong>Kadıköy klinik pilates</strong>
            </div>
            <div className="orbit-card orbit-card-lead">
              <span>Yeni lead</span>
              <strong>WhatsApp + Harita</strong>
            </div>
            <div className="orbit-card orbit-card-brand">
              <img src="/brand/fizyoflow-current-mark.png" alt="" />
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

      <section className="section-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Yayına Hazır Klinik Vitrini</p>
            <h2>Danışan kliniği ilk kez gördüğünde ne sunduğunu, nerede olduğunu ve nasıl ulaşacağını hemen anlar.</h2>
            <p>
              Bu örnek sayfa; SEO başlığı, lokasyon odaklı açıklama, hızlı iletişim, hizmet kartları, lead formu ve
              LocalBusiness schema yapısının Fizyoflow vitrini içinde nasıl birleştiğini gösterir. Dil, kliniği
              abartmadan güçlü gösterir; ziyaretçiyi de doğru aksiyona davet eder.
            </p>
            <div className="quick-contact">
              {trustSignals.map((signal) => (
                <span className="contact-pill" key={signal}>{signal}</span>
              ))}
            </div>
            <div className="clinic-highlight-grid">
              {clinicHighlights.map((item) => (
                <div className="clinic-highlight" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <aside id="lead" className="contact-card">
            <div className="contact-card-brand">
              <img src="/brand/fizyoflow-current-mark.png" alt="" />
              <span>Fizyoflow lead formu</span>
            </div>
            <h3>Bilgi Talebi</h3>
            <p className="small">Bu form gerçek klinik sayfasında danışan adayını kliniğe lead olarak iletir.</p>
            <form className="grid">
              <input placeholder="Ad Soyad" aria-label="Ad Soyad" />
              <input placeholder="Telefon" aria-label="Telefon" inputMode="tel" />
              <input placeholder="İlgilendiğiniz hizmet" aria-label="İlgilendiğiniz hizmet" />
              <textarea rows={4} placeholder="Kısaca ihtiyacınızı yazın" aria-label="Kısaca ihtiyacınızı yazın" />
              <button type="button">Kliniğe Bilgi Talebi Gönder</button>
            </form>
          </aside>
        </div>
      </section>

      <section className="section-band movement-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Klinik Dili</p>
            <h2>Bir fizyoterapi vitrini, danışanın bedenine dair ilk sorusuna sakin bir cevap vermeli.</h2>
            <p>
              Atlas Fizyo örneğinde sayfa; “hemen randevu al” baskısından önce güven, açıklık ve yön bulma hissi verir.
              Çünkü iyi bir klinik deneyimi, ilk tıklamada bile kişiye yalnız olmadığını hissettiren bir ritim kurar.
            </p>
          </div>
          <div className="movement-score" aria-label="Atlas Fizyo hareket notasyonu">
            <span>Omurga</span>
            <span>Nefes</span>
            <span>Denge</span>
            <span>Güç</span>
            <span>Ritim</span>
            <div className="movement-phone">
              <div className="phone-speaker" />
              <div className="phone-screen screenshot-screen">
                <img src="/product-screens/admin-calendar.png" alt="Fizyoflow takvim ekranı" width="1206" height="2622" />
              </div>
            </div>
          </div>
        </div>
        <div className="container principle-grid">
          {movementPrinciples.map((item) => (
            <article className="principle-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band muted-band">
        <div className="container section-heading">
          <p className="eyebrow">Hasta Yolculuğu</p>
          <h2>Vitrin sayfası ilk ilgiyi randevu niyetine çevirir.</h2>
        </div>
        <div className="container journey-grid">
          {journey.map((item, index) => (
            <article className="journey-card" key={item.title}>
              <span>{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band">
        <div className="container section-heading">
          <p className="eyebrow">Galeri</p>
          <h2>Gerçek mekan hissi güveni artırır.</h2>
        </div>
        <div className="container gallery-grid branded-gallery">
          {gallery.map((image) => (
            <img key={image} src={image} alt="Atlas Fizyo örnek galeri" />
          ))}
          <div className="gallery-product-card">
            <img src="/brand/fizyoflow-current-mark.png" alt="" />
            <span>Paylaşılabilir klinik linki</span>
            <strong>atlasfizyo.fizyoflow.com</strong>
          </div>
        </div>
      </section>

      <section id="services" className="section-band muted-band">
        <div className="container section-heading">
          <p className="eyebrow">Hizmetler</p>
          <h2>Klinik vitrini hizmetleri anlaşılır ve paylaşılabilir hale getirir.</h2>
        </div>
        <div className="container service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <h3>{service.title}</h3>
              <p>{service.desc}</p>
              <span>{service.price}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band">
        <div className="container split-section">
          <div>
            <p className="eyebrow">Paylaşım Kiti</p>
            <h2>Klinik sahibi sayfasını sadece yayınlamaz, aktif şekilde kullanır.</h2>
            <p>
              Fizyoflow vitrini; Google profilinde, Instagram bio alanında ve WhatsApp görüşmelerinde güven veren tek
              bağlantı olarak çalışır.
            </p>
          </div>
          <div className="campaign-stack">
            {campaignCards.map((card) => (
              <article className="campaign-card" key={card.title}>
                <span aria-hidden="true" />
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
