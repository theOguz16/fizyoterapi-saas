import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo Talebiniz Alındı | Fizyoflow",
  description: "Fizyoflow demo talebiniz alındı. Görüşmede seans, paket, check-in ve danışan takip akışınız birlikte değerlendirilir.",
  alternates: { canonical: "/tesekkurler" },
};

const prepItems = [
  "Klinikte bugün en çok zaman alan takip işi",
  "Seans, paket, ekip veya danışan takibinde en çok aksayan nokta",
  "Fizyoterapistlerin check-in ve katılımı bugün nasıl işlediği",
  "Danışanların kalan hak ve yaklaşan seans bilgisini nasıl takip ettiği",
];

export default function ThanksPage() {
  return (
    <main className="thanks-page">
      <section className="container thanks-panel">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span>
          <span>Fizyoflow</span>
        </a>
        <p className="eyebrow">Demo talebi alındı</p>
        <h1>Görüşmede kliniğiniz için net bir başlangıç planı çıkaracağız.</h1>
        <p className="lead">
          Fizyoflow ekibi size kısa sürede dönüş yapacak. Görüşmede seans, paket, check-in, ekip ve danışan takip
          akışınız birlikte netleşir.
        </p>
        <div className="thanks-grid">
          <div className="thanks-card">
            <h2>Hazırlık için</h2>
            {prepItems.map((item) => <p key={item}>{item}</p>)}
          </div>
          <div className="thanks-card">
            <h2>Bu sırada bakabilirsiniz</h2>
            <a href="/#urun">Gerçek ürün ekranları</a>
            <a href="/#demo">Demo formuna dön</a>
          </div>
        </div>
      </section>
    </main>
  );
}
