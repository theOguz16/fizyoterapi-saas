import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları | Fizyoflow",
  description: "Fizyoflow web sitesi, ürün tanıtımı ve klinik vitrinleri için kullanım şartları.",
  alternates: { canonical: "/kullanim-sartlari" },
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="brand" href="/"><span className="brand-mark"><img src="/brand/fizyoflow-mark.svg" alt="" /></span><span>Fizyoflow</span></a>
        <p className="eyebrow">Şartlar</p>
        <h1>Kullanım Şartları</h1>
        <p>
          Fizyoflow web sitesi ve klinik vitrinleri bilgilendirme, tanıtım, lead toplama ve klinik yönetim süreçlerini
          destekleme amacıyla sunulur.
        </p>
        <h2>Sağlık Bilgilendirmesi</h2>
        <p>Klinik vitrinleri tanı, tedavi veya acil sağlık hizmeti sunmaz. Hizmet detayları için ilgili klinikle görüşülmelidir.</p>
        <h2>Klinik İçeriği</h2>
        <p>Public vitrinlerdeki hizmet, adres, telefon ve çalışma bilgileri ilgili klinik ve Fizyoflow ekibinin sağladığı verilere dayanır.</p>
        <h2>Sorumluluk</h2>
        <p>Fizyoflow, yazılım ve dijital vitrin altyapısı sağlar; klinik hizmetin uygulanmasından ilgili klinik sorumludur.</p>
      </section>
    </main>
  );
}
