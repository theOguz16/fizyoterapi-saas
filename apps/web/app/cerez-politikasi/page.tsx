import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çerez Politikası | Fizyoflow",
  description: "Fizyoflow web sitesi ve klinik vitrinleri için çerez politikası.",
  alternates: { canonical: "/cerez-politikasi" },
};

export default function CookiePolicyPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="brand" href="/"><span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span><span>Fizyoflow</span></a>
        <p className="eyebrow">Çerezler</p>
        <h1>Çerez Politikası</h1>
        <p>
          Fizyoflow, zorunlu oturum/güvenlik ölçümleri dışında GA4 ve PostHog gibi analitik araçları yalnızca kullanıcı
          onayıyla etkinleştirir.
        </p>
        <h2>Zorunlu Kayıtlar</h2>
        <p>Güvenlik, rate limit, lead teslimi ve temel public site eventleri için teknik kayıtlar tutulabilir.</p>
        <h2>Analitik Çerezleri</h2>
        <p>Site kullanımını, trafik kaynaklarını ve CTA dönüşümlerini anlamak için açık rıza sonrası kullanılır.</p>
        <h2>Tercih Yönetimi</h2>
        <p>Analitik tercihiniz tarayıcınızda saklanır. Tercihinizi değiştirmek için tarayıcı site verilerini temizleyebilirsiniz.</p>
      </section>
    </main>
  );
}
