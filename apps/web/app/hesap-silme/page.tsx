import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hesap Silme | Fizyoflow",
  description: "Fizyoflow hesabınızı ve ilişkili kişisel verilerinizi silme talebi yönergeleri.",
  alternates: { canonical: "/hesap-silme" },
};

export default function AccountDeletionPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="brand" href="/"><span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span><span>Fizyoflow</span></a>
        <p className="eyebrow">Hesap Silme</p>
        <h1>Fizyoflow Hesap Silme Talebi</h1>
        <p>
          Fizyoflow mobil uygulamasında veya web/admin panelinde oluşturduğunuz hesabı ve hesabınızla ilişkili kişisel
          verileri silme hakkına sahipsiniz. Talebinizi e-posta yoluyla iletebilir veya mobil uygulamadaki &quot;Hesap silme
          talebi&quot; aksiyonunu kullanabilirsiniz.
        </p>

        <h2>Talep nasıl iletilir?</h2>
        <p>
          destek@fizyoflow.com adresine &quot;Fizyoflow hesap silme talebi&quot; konu başlığıyla e-posta gönderin. E-postanızda
          hesabınızla ilişkili ad soyad, e-posta adresi veya telefon numarasını ve varsa bağlı olduğunuz klinik adını
          paylaşmanız kimlik doğrulama sürecini hızlandırır.
        </p>

        <h2>Silinen veriler</h2>
        <p>
          Kimlik ve iletişim bilgileriniz, oturum kayıtlarınız, bildirim tokenleriniz, üyelik/rol bağlantılarınız, kişisel
          tercih kayıtlarınız ve hesabınızla doğrudan ilişkili uygulama verileri silinir veya anonimleştirilir. Klinik
          hesabı adına tutulan randevu, paket, ödeme durumu, seans, ölçüm veya operasyon kayıtları ilgili kliniğin yasal ve
          operasyonel saklama yükümlülükleri nedeniyle tamamen silinmeden önce ayrıca değerlendirilebilir.
        </p>

        <h2>Saklanabilecek kayıtlar</h2>
        <p>
          Vergi, muhasebe, ödeme uyuşmazlığı, güvenlik, dolandırıcılık önleme, denetim ve yasal yükümlülük gerektiren
          kayıtlar, yalnızca zorunlu amaçlarla ve erişimi sınırlandırılmış biçimde saklanabilir. Bu kayıtlar aktif ürün
          deneyimi veya pazarlama amacıyla kullanılmaz.
        </p>

        <h2>İşlem süresi</h2>
        <p>
          Talebiniz alındıktan sonra kimlik doğrulama adımları tamamlanır ve hesabınızla ilişkili silme işlemleri makul
          süre içinde sonuçlandırılır. Talebin kapsamı, bağlı klinik kayıtları veya yasal saklama yükümlülükleri nedeniyle
          ek bilgi gerekirse sizinle e-posta üzerinden iletişime geçilir.
        </p>

        <h2>Mobil uygulamadan erişim</h2>
        <p>
          Fizyoflow mobil uygulamasında profil veya hesap güvenliği bölümünden &quot;Hesap silme talebi&quot; aksiyonuna
          ulaşabilirsiniz. Bu aksiyon destek@fizyoflow.com adresine hesap silme talebi oluşturmanız için e-posta ekranını
          açar.
        </p>

        <h2>İletişim</h2>
        <p>
          Hesap silme, veri düzeltme veya KVKK kapsamındaki haklarınız için destek@fizyoflow.com adresinden bizimle
          iletişime geçebilirsiniz. Gizlilik metni için <a href="/gizlilik-politikasi">Gizlilik Politikası</a> sayfasını
          inceleyebilirsiniz.
        </p>
      </section>
    </main>
  );
}
