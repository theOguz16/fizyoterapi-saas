import type { Metadata } from "next";
import { BrandLockup } from "../../components/brand-lockup";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Fizyoflow",
  description: "Fizyoflow demo ve klinik vitrin formları için KVKK aydınlatma metni.",
  alternates: { canonical: "/kvkk" },
};

export default function KvkkPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="legal-brand" href="/" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <p className="eyebrow">KVKK</p>
        <h1>KVKK Aydınlatma Metni</h1>
        <p>
          Demo ve klinik bilgi formlarında paylaştığınız kişisel veriler, talebinizin alınması ve ilgili ekibin sizinle
          iletişime geçmesi amacıyla işlenir.
        </p>
        <h2>Veri Kategorileri</h2>
        <p>Kimlik, iletişim, klinik/işletme bilgisi ve işlem güvenliği verileri.</p>
        <h2>Aktarım</h2>
        <p>Klinik vitrininden gelen lead bilgileri ilgili klinik işletmesine aktarılabilir. Analitik araçları yalnızca açık rıza sonrası çalışır.</p>
        <h2>Haklarınız</h2>
        <p>KVKK kapsamındaki başvuru, düzeltme, silme ve itiraz haklarınızı Fizyoflow iletişim kanalları üzerinden kullanabilirsiniz.</p>
        <h2>Not</h2>
        <p>Bu metin yayın öncesi taslaktır; canlı kullanım öncesinde hukuki danışmanlıkla son kez gözden geçirilmelidir.</p>
      </section>
    </main>
  );
}
