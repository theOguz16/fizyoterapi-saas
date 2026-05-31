import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo Talebiniz Alındı | Fizyoflow",
  description: "Fizyoflow demo talebiniz alındı. Görüşme öncesi klinik akışınızı ve public vitrin ihtiyacınızı hazırlayın.",
  alternates: { canonical: "/tesekkurler" },
};

const prepItems = [
  "Klinikte bugün en çok zaman alan takip işi",
  "Randevu, paket, ekip veya web vitrini tarafındaki en acil ihtiyaç",
  "Google Maps, Instagram ve WhatsApp üzerinden gelen talep akışı",
  "Public klinik sayfasında görünmesini istediğiniz hizmetler",
];

export default function ThanksPage() {
  return (
    <main className="thanks-page">
      <section className="container thanks-panel">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/brand/fizyoflow-mark.svg" alt="" /></span>
          <span>Fizyoflow</span>
        </a>
        <p className="eyebrow">Demo talebi alındı</p>
        <h1>Görüşmede kliniğiniz için net bir başlangıç planı çıkaracağız.</h1>
        <p className="lead">
          Fizyoflow ekibi size kısa sürede dönüş yapacak. Görüşmede mobil operasyon, public klinik vitrini,
          SEO/Maps görünürlüğü ve lead takibi birlikte netleşir.
        </p>
        <div className="thanks-grid">
          <div className="thanks-card">
            <h2>Hazırlık için</h2>
            {prepItems.map((item) => <p key={item}>{item}</p>)}
          </div>
          <div className="thanks-card">
            <h2>Bu sırada bakabilirsiniz</h2>
            <a href="/ornek-klinik">Örnek klinik vitrini</a>
            <a href="/#growth">SEO + Maps modeli</a>
            <a href="/#demo">Demo formuna dön</a>
          </div>
        </div>
      </section>
    </main>
  );
}
