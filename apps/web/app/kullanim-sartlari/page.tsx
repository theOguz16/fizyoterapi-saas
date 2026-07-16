import type { Metadata } from "next";
import { BrandLockup } from "../../components/brand-lockup";

export const metadata: Metadata = {
  title: "Kullanım Şartları | Fizyoflow",
  description: "Fizyoflow mobil uygulaması, web sitesi, klinik yönetimi ve klinik vitrinleri için kullanım şartları.",
  alternates: { canonical: "/kullanim-sartlari" },
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="legal-brand" href="/" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <p className="eyebrow">Şartlar</p>
        <h1>Kullanım Şartları</h1>
        <p>
          Fizyoflow mobil uygulaması, web sitesi ve klinik vitrinleri; hesap, klinik, ekip, danışan, paket, randevu,
          katılım, bildirim ve raporlama süreçlerini destekleyen bir yazılım hizmeti olarak sunulur. Hesap açarken bu
          şartları ayrıca kabul edersiniz; KVKK Aydınlatma Metni ve isteğe bağlı pazarlama tercihi bu kabulden ayrıdır.
        </p>
        <h2>Hesap ve Yetki Güvenliği</h2>
        <p>Kullanıcı, hesap bilgilerinin doğruluğundan ve giriş bilgilerinin güvenliğinden sorumludur. Klinik yöneticileri ekip ve danışan erişimlerini yalnız görev için gerekli kapsamda yetkilendirmelidir.</p>
        <h2>Sağlık Bilgilendirmesi</h2>
        <p>Klinik vitrinleri tanı, tedavi veya acil sağlık hizmeti sunmaz. Hizmet detayları için ilgili klinikle görüşülmelidir.</p>
        <h2>Klinik İçeriği</h2>
        <p>Public vitrinlerdeki hizmet, adres, telefon ve çalışma bilgileri ilgili klinik ve Fizyoflow ekibinin sağladığı verilere dayanır.</p>
        <h2>Sorumluluk</h2>
        <p>Fizyoflow, yazılım ve dijital vitrin altyapısı sağlar; klinik hizmetin uygulanmasından ilgili klinik sorumludur.</p>
        <h2>Gizlilik</h2>
        <p>Kişisel verilerin işlenmesine ilişkin ayrıntılar için <a href="/kvkk">KVKK Aydınlatma Metni</a> ve <a href="/gizlilik-politikasi">Gizlilik Politikası</a> incelenmelidir.</p>
        <h2>Metin Sürümü</h2>
        <p>Son güncelleme: 16.07.2026. Hukuki metin sürümü: 2026-07-16.</p>
      </section>
    </main>
  );
}
