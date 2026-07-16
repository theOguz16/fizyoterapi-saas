import type { Metadata } from "next";
import { BrandLockup } from "../../components/brand-lockup";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Fizyoflow",
  description: "Fizyoflow mobil uygulaması, web sitesi ve klinik yönetim hizmetleri için KVKK aydınlatma metni.",
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
          Bu metin; Fizyoflow mobil uygulaması, web sitesi, klinik vitrinleri ve yönetim hizmetleri kapsamında kişisel
          verilerinizin hangi amaçlarla işlendiği hakkında sizi bilgilendirir. Hesap ve platform işletimi bakımından
          veri sorumlusu Oğuz Han UYAR&apos;dır. Bir kliniğin kendi danışanları ve çalışanları için oluşturduğu klinik
          kayıtlarında ilgili klinik ayrıca veri sorumlusu olabilir.
        </p>

        <h2>Veri Kategorileri</h2>
        <p>
          Kimlik ve iletişim bilgileri; hesap, rol ve klinik üyeliği bilgileri; randevu, paket, ödeme durumu ve katılım
          kayıtları; klinik ve ekip bilgileri; cihaz, güvenlik, hata ve kullanım kayıtları işlenebilir. Ölçüm, gelişim
          veya seans notu gibi sağlıkla ilişkili özel nitelikli veriler yalnız ilgili klinik ilişkisi kurulduktan sonra,
          sunulan hizmet için gerekli olduğu ölçüde ve uygun hukuki işleme şartı ile işlenir. Klinik keşfi sırasında
          belirti, tanı veya sağlık geçmişi istenmez.
        </p>

        <h2>İşleme Amaçları ve Hukuki Sebepler</h2>
        <p>
          Veriler; hesap oluşturma ve kimlik doğrulama, klinik ve ekip yönetimi, randevu ve paket süreçleri, bildirim,
          destek, güvenlik, hata giderme, yasal yükümlülükler ve hakkın tesisi veya korunması amaçlarıyla işlenir.
          İşleme faaliyetine göre sözleşmenin kurulması veya ifası, hukuki yükümlülük, bir hakkın tesisi/kullanılması,
          meşru menfaat ya da açık rıza hukuki sebeplerinden uygun olanına dayanılır. Pazarlama iletişimi isteğe bağlıdır
          ve hizmetin kullanılması için şart değildir.
        </p>

        <h2>Toplama Yöntemi</h2>
        <p>
          Veriler mobil ve web formları, klinik yöneticisi veya yetkili uzman girişleri, QR/davet bağlantıları, cihaz
          izinleri, uygulama mağazaları ve hizmetin güvenli çalışması için oluşan teknik kayıtlar üzerinden elektronik
          olarak toplanır. Aydınlatma metnini okuduğunuza ilişkin kayıt açık rıza yerine geçmez; gerekli açık rızalar
          ilgili amaç için ayrıca alınır.
        </p>

        <h2>Aktarım ve Alıcı Grupları</h2>
        <p>
          Veriler; bağlı olduğunuz klinik, yetkili klinik çalışanları ve hizmetin çalışması için gerekli barındırma,
          veritabanı, bildirim, e-posta, hata izleme, analitik, ödeme ve uygulama mağazası sağlayıcılarıyla, amaçla sınırlı
          ve gerekli güvenlik önlemleri altında paylaşılabilir. Yetkili kamu kurumlarıyla yalnız hukuki yükümlülük halinde
          paylaşım yapılır. Yurt dışı aktarım gerektiren sağlayıcılarda KVKK&apos;daki aktarım şartları uygulanır.
        </p>

        <h2>Saklama Süreleri</h2>
        <p>
          Hesap ve klinik operasyon kayıtları hizmet ilişkisi boyunca ve sonrasında uygulanabilir yasal zamanaşımı veya
          saklama yükümlülüğü süresince tutulur. Teknik güvenlik kayıtları kural olarak 24 aya kadar saklanır. Pazarlama
          tercihi geri alındığında ileti gönderimi durdurulur; tercih kaydı hukuki ispat için gerekli süreyle sınırlı
          tutulur. Klinik sağlık kayıtlarının süresi, ilgili kliniğin yükümlülükleri ve işleme amacıyla belirlenir.
          Süresi dolan veriler silinir, yok edilir veya anonimleştirilir.
        </p>

        <h2>Haklarınız</h2>
        <p>
          KVKK&apos;nın 11. maddesi kapsamındaki bilgi alma, düzeltme, silme/yok etme, aktarılan üçüncü kişileri öğrenme,
          otomatik işleme sonucuna itiraz ve zararın giderilmesini talep etme haklarınızı destek@fizyoflow.com üzerinden
          kullanabilirsiniz. Başvurunuzun güvenli biçimde sonuçlandırılması için kimlik doğrulaması istenebilir.
        </p>

        <h2>Metin Sürümü</h2>
        <p>Son güncelleme: 16.07.2026. Hukuki metin sürümü: 2026-07-16.</p>
      </section>
    </main>
  );
}
