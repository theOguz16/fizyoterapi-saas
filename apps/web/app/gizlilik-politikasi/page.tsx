import type { Metadata } from "next";
import { BrandLockup } from "../../components/brand-lockup";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Fizyoflow",
  description: "Fizyoflow mobil uygulaması, web sitesi ve klinik vitrinleri için gizlilik politikası.",
  alternates: { canonical: "/gizlilik-politikasi" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="legal-brand" href="/" aria-label="Fizyoflow ana sayfa">
          <BrandLockup />
        </a>
        <p className="eyebrow">Gizlilik Politikası TR</p>
        <h1>Fizyoflow Gizlilik Politikası</h1>
        <p>
          Bu gizlilik politikası, Oğuz Han UYAR tarafından mobil cihazlar ve web için geliştirilen Fizyoflow uygulaması,
          Fizyoflow web sitesi, admin paneli ve klinik vitrinleri (birlikte &quot;Uygulama&quot; veya &quot;Hizmet&quot; olarak anılacaktır)
          için geçerlidir. Hizmet, fizyoterapi klinikleri, klinik pilates stüdyoları, eğitmenler ve üyeler için dijital
          klinik yönetimi altyapısı sunar.
        </p>
        <p>
          Bu metin 16.07.2026 tarihinden itibaren geçerlidir. Hizmetin bazı bölümleri ilgili klinik veya işletme hesabı
          adına kullanılabilir; bu durumda klinik kendi danışanları ve çalışanları ile ilgili süreçlerde ayrıca veri
          sorumlusu veya veri işleyen rolünde olabilir.
        </p>

        <h2>Uygulama hangi bilgileri elde eder ve nasıl kullanır?</h2>
        <p>
          Fizyoflow, kayıt, giriş, klinik başvurusu, salon katılımı, randevu, paket, ödeme talebi, ölçüm takibi, bildirim
          tercihi ve destek süreçlerinde paylaştığınız bilgileri işleyebilir. Bu bilgiler ad soyad, e-posta, telefon,
          şifrelenmiş oturum bilgileri, rol bilgisi, klinik adı, şehir/ilçe, adres, çalışma saatleri, eğitmen bilgileri,
          paket ve üyelik kayıtları, randevu ve katılım kayıtları, kampanya veya lead formu notları ve uygulama içi işlem
          geçmişini içerebilir.
        </p>
        <p>
          Üyeler tarafından girilen veya klinik/eğitmen hesabı tarafından kaydedilen ölçüm, gelişim ve seans notları gibi
          bilgiler yalnızca hizmetin sunulması, klinik operasyonunun yürütülmesi ve kullanıcının uygulama deneyiminin
          sağlanması amacıyla işlenir. Fizyoflow acil sağlık hizmeti, tanı veya tedavi hizmeti sunmaz; sağlık hizmetinin
          uygulanmasından ilgili klinik veya uzman sorumludur.
        </p>
        <p>
          Klinik bağlantısı kurulmadan önceki genel keşif akışı belirti, tanı, gebelik durumu veya sağlık geçmişi istemez.
          Sağlıkla ilişkili özel nitelikli veriler ancak bağlı klinikteki ilgili özellik kullanıldığında, amaçla sınırlı
          biçimde ve uygulanabilir hukuki işleme şartı sağlanarak alınır.
        </p>

        <h2>Otomatik olarak hangi bilgiler toplanır?</h2>
        <p>
          Hizmet; cihaz türü, işletim sistemi, uygulama sürümü, IP adresi, yaklaşık bağlantı bölgesi, hata kayıtları,
          performans ölçümleri, oturum güvenliği kayıtları, cihaz bildirim tokeni, sayfa görüntüleme ve özellik kullanım
          bilgileri gibi teknik verileri otomatik olarak toplayabilir. Bu veriler güvenlik, hata giderme, bildirim
          gönderimi, kötüye kullanımın önlenmesi ve ürün performansının iyileştirilmesi için kullanılır.
        </p>

        <h2>Konum bilgisi işleniyor mu?</h2>
        <p>
          Fizyoflow, klinik keşfi, şehir/ilçe seçimi, klinik vitrini, harita yönlendirmesi ve ilgili klinikleri göstermek
          için kullanıcının seçtiği şehir/ilçe gibi konum benzeri tercihleri işleyebilir. Cihazın hassas ve gerçek zamanlı
          GPS konumu, uygulama içindeki açık izin akışı olmadan toplanmaz. Harita, yönlendirme veya lokasyon bağlantıları
          için üçüncü taraf harita servisleri kullanıldığında ilgili servisin kendi gizlilik koşulları geçerli olabilir.
        </p>

        <h2>Bildirimler ve cihaz izinleri</h2>
        <p>
          Randevu, paket, onay, grup dersi, risk uyarısı ve hesap güvenliği bildirimleri için cihaz bildirim izni
          istenebilir. Bildirimleri cihaz ayarlarınızdan veya uygulamadaki bildirim tercihleri ekranından yönetebilirsiniz.
          QR kod okutma, galeri veya kamera gibi izinler yalnızca ilgili özelliği kullanmanız için gerektiğinde talep edilir.
        </p>

        <h2>Ödeme ve abonelik bilgileri</h2>
        <p>
          Fizyoflow, klinik paketleri, üyelik planları veya mobil abonelik süreçlerinde ödeme durumu, plan bilgisi, işlem
          referansı ve fatura/abonelik durumu gibi kayıtları işleyebilir. Kart numarası gibi hassas ödeme bilgileri
          Fizyoflow sunucularında saklanmaz; ödeme ve abonelik işlemleri ilgili uygulama mağazası, ödeme sağlayıcısı veya
          üçüncü taraf servisler tarafından kendi güvenlik standartları kapsamında yürütülür.
        </p>

        <h2>Yapay zeka teknolojileri kullanılıyor mu?</h2>
        <p>
          Fizyoflow&apos;un mevcut hizmet kapsamı; randevu, paket, klinik vitrini, lead, bildirim ve operasyon yönetimi
          süreçlerine odaklanır. Uygulama içinde yapay zeka destekli bir özellik etkinleştirilirse, hangi verilerin hangi
          sağlayıcıya gönderileceği ve açık onay süreci bu politikada veya ilgili özellik ekranında ayrıca belirtilecektir.
        </p>

        <h2>Üçüncü taraflar bilgilere erişir mi?</h2>
        <p>
          Fizyoflow, hizmetin çalışması için bulut barındırma, veritabanı, hata izleme, analitik, bildirim, e-posta, ödeme,
          uygulama mağazası ve harita servislerinden yararlanabilir. Bu sağlayıcılar verileri yalnızca hizmetin sunumu,
          güvenliği, ölçümü ve destek süreçleri için işler. Klinik vitrini veya lead formu üzerinden paylaşılan bilgiler,
          talebinize dönüş yapılabilmesi için ilgili klinik işletmesiyle paylaşılabilir.
        </p>
        <p>
          Zorunlu hallerde bilgiler; yasal yükümlülüklere uymak, mahkeme veya yetkili kurum taleplerine yanıt vermek,
          haklarımızı korumak, dolandırıcılığı veya güvenlik ihlallerini araştırmak ve kullanıcıların güvenliğini sağlamak
          amacıyla açıklanabilir.
        </p>

        <h2>Analitik ve çerezler</h2>
        <p>
          Web sitesi ve public klinik vitrinlerinde zorunlu güvenlik kayıtları dışında GA4, PostHog veya benzeri analitik
          araçları açık rıza sonrasında çalışır. Analitik veriler; trafik kaynaklarını, CTA tıklamalarını, form dönüşümünü
          ve ürün performansını anlamak için kullanılır. Çerez tercihlerinizi tarayıcı ayarları veya çerez bannerı
          üzerinden yönetebilirsiniz.
        </p>

        <h2>Kayıt beyanları ve pazarlama tercihi</h2>
        <p>
          Kullanım Şartları kabulü, KVKK Aydınlatma Metni&apos;nin okunduğuna ilişkin bildirim ve isteğe bağlı pazarlama
          tercihi ayrı kaydedilir. Aydınlatma metnini okuduğunuzu belirtmeniz açık rıza verdiğiniz anlamına gelmez.
          Pazarlama iletişimini reddetmeniz hesap açmanızı veya temel hizmetleri kullanmanızı engellemez; bu tercihi daha
          sonra geri alabilirsiniz.
        </p>

        <h2>Vazgeçme haklarınız nelerdir?</h2>
        <p>
          Uygulamayı cihazınızdan kaldırarak mobil uygulama kaynaklı yeni veri toplamayı durdurabilirsiniz. Bildirimleri
          cihaz ayarlarından kapatabilir, analitik çerezleri reddedebilir ve pazarlama iletişimlerinden ayrılabilirsiniz.
          Hesabınız veya verilerinizle ilgili talepler için destek kanalı üzerinden bize ulaşabilirsiniz.
        </p>

        <h2>Veri saklama politikası</h2>
        <p>
          Hesap, klinik, randevu, paket, ödeme durumu ve operasyon kayıtları hizmeti kullandığınız süre boyunca ve yasal,
          sözleşmesel veya meşru iş gerekliliklerinin devam ettiği makul süre boyunca saklanır. Otomatik teknik kayıtlar
          ve güvenlik logları kural olarak 24 aya kadar tutulabilir; sonrasında anonimleştirilmiş veya toplulaştırılmış
          şekilde saklanabilir.
        </p>

        <h2>Hesabımı ve verilerimi nasıl sildirebilirim?</h2>
        <p>
          Hesabınızı ve Fizyoflow sistemlerinde kayıtlı kişisel verilerinizi silme talebinizi destek@fizyoflow.com
          adresine &quot;Fizyoflow hesap silme talebi&quot; konu başlığıyla e-posta göndererek iletebilirsiniz. Kimlik doğrulama ve
          talep kapsamı kontrol edildikten sonra, hesabınızla ilişkili veriler makul süre içinde silinir veya yasal
          saklama yükümlülüğü bulunan kayıtlar erişimi sınırlandırılmış şekilde tutulur. Ayrıntılı yönergeler için{" "}
          <a href="/hesap-silme">Hesap Silme</a> sayfasını ziyaret edebilirsiniz.
        </p>

        <h2>Çocukların gizliliği</h2>
        <p>
          Fizyoflow, 13 yaşın altındaki çocuklara yönelik değildir ve 13 yaşın altındaki kişilerden bilerek kişisel veri
          toplamaz. Böyle bir verinin işlendiğini fark edersek makul süre içinde sileriz. Ebeveyn veya vasiyseniz ve bir
          çocuğun bize kişisel veri sağladığını düşünüyorsanız destek@fizyoflow.com adresinden bizimle iletişime geçin.
        </p>

        <h2>Bilgileriniz nasıl korunur?</h2>
        <p>
          Fizyoflow, işlediği verileri korumak için yetkilendirme, erişim kontrolü, şifreleme, güvenli oturum yönetimi,
          yedekleme, loglama ve prosedürel güvenlik önlemleri uygular. Buna rağmen internet üzerinden yapılan hiçbir
          aktarım veya elektronik saklama yöntemi mutlak güvenlik garantisi vermez.
        </p>

        <h2>Değişiklikler</h2>
        <p>
          Bu gizlilik politikası zaman zaman güncellenebilir. Güncel metin ve yürürlük tarihi bu sayfada yayımlanır.
          Yeni bir açık rıza gerektiren amaç ortaya çıkarsa yalnızca hizmeti kullanmaya devam etmeniz rıza sayılmaz;
          ilgili tercih ayrıca istenir.
        </p>

        <h2>İletişim</h2>
        <p>
          Gizlilik, KVKK, hesap silme veya uygulama uygulamaları hakkında sorularınız için Hizmet Sağlayıcı ile
          destek@fizyoflow.com adresinden iletişime geçebilirsiniz.
        </p>

        <p>
          English version: <a href="/privacy-policy">Privacy Policy EN</a>
        </p>
      </section>
    </main>
  );
}
