export const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
export const APP_STORE_URL = "https://apps.apple.com/tr/app/fizyoflow/id6771870032?l=tr";
export const CANONICAL_DESCRIPTION = "Fizyoflow, fizyoterapi ve klinik pilates merkezleri için randevu, paket, danışan, ekip, QR ve gelir/seans takibini tek mobil akışta birleştiren klinik yönetim platformudur.";

export const screenGroups = [
  {
    role: "Klinik yönetimi",
    fallbackImage: "/product-screens/admin-dashboard.png",
    summary: "Klinik sahibi seans, paket, ödeme ve ekip yoğunluğunu aynı merkezden takip eder.",
    screens: [
      { label: "Yönetim merkezi", detail: "Günün seans, danışan ve operasyon özeti", image: "/product-screens/admin-dashboard.png" },
      { label: "Salon takvimi", detail: "Ekip programı ve bireysel seanslar", image: "/product-screens/admin-calendar.png" },
      { label: "Danışan ve ekip listesi", detail: "Rol, paket ve takip durumuna göre filtreleme", image: "/product-screens/admin-members.png" },
      { label: "Danışan detayı", detail: "Paket, katılım, ölçüm ve risk geçmişi", image: "/product-screens/admin-member-detail.png" },
      { label: "Fizyoterapist detayı", detail: "Kazanç, ders ve yetkinlik görünümü", image: "/product-screens/admin-trainer-detail.png" },
      { label: "Paket yönetimi", detail: "Hizmet, fiyat, hak ve ekip eşleştirmesi", image: "/product-screens/admin-packages.png" },
      { label: "Gelir detayı", detail: "Satışlar, tahmin ve dönemsel gelir analizi", image: "/product-screens/admin-revenue-detail.png" },
      { label: "Kampanyalar", detail: "Referans, sadakat ve indirim kuralları", image: "/product-screens/admin-campaigns.png" },
    ],
  },
  {
    role: "Ekip operasyonu",
    fallbackImage: "/product-screens/trainer-home.png",
    summary: "Fizyoterapist günlük seanslarını, danışan bilgisini ve check-in işlemini cebinden yürütür.",
    screens: [
      { label: "Günlük ana ekran", detail: "Bugünkü seanslar ve hızlı işlemler", image: "/product-screens/trainer-home.png" },
      { label: "Bugünün akışı", detail: "Sıradaki seans, risk ve son check-in", image: "/product-screens/trainer-today.png" },
      { label: "Check-in", detail: "QR veya kodla katılım ve hak düşümü", image: "/product-screens/trainer-checkin.png" },
      { label: "Danışan detayı", detail: "Aktif paket, katılım ve ölçüm bilgileri", image: "/product-screens/trainer-client-detail.png" },
      { label: "Grup dersleri", detail: "Ders oluşturma, paket ve davet yönetimi", image: "/product-screens/trainer-group-classes.png" },
      { label: "Fizyoterapist QR", detail: "Klinik içi kimlik ve yetki doğrulama", image: "/product-screens/trainer-qr.png" },
      { label: "Profil ve uzmanlık", detail: "Hesap, yetkinlik ve iletişim bilgileri", image: "/product-screens/trainer-profile.png" },
    ],
  },
  {
    role: "Danışan deneyimi",
    fallbackImage: "/product-screens/member-home.png",
    summary: "Danışan yaklaşan seansını, kalan hakkını ve paket geçmişini uygulamada takip eder.",
    screens: [
      { label: "Danışan ana ekranı", detail: "Sonraki seans, kalan hak ve günlük özet", image: "/product-screens/member-home.png" },
      { label: "Seans detayı", detail: "Saat, fizyoterapist ve giriş durumu", image: "/product-screens/member-booking-detail.png" },
      { label: "Paket ve haklar", detail: "Kalan kullanım, geçmiş ve ödeme bilgisi", image: "/product-screens/member-package.png" },
      { label: "Ölçüm özeti", detail: "Güncel değerler ve değişim grafikleri", image: "/product-screens/member-measurements.png" },
      { label: "Ölçüm geçmişi", detail: "Tarihli fiziksel gelişim kayıtları", image: "/product-screens/member-measurement-history.png" },
      { label: "Gelişim", detail: "Katılım, paket kullanımı ve ölçüm trendi", image: "/product-screens/member-progress.png" },
      { label: "Ders giriş QR", detail: "Doğru seanstan otomatik hak düşümü", image: "/product-screens/member-qr.png" },
      { label: "Referanslar", detail: "Arkadaş daveti ve kazanım takibi", image: "/product-screens/member-referrals.png" },
      { label: "Profil", detail: "Hesap ve üyelik işlemleri", image: "/product-screens/member-profile.png" },
    ],
  },
] as const;

export const trustItems = [
  { label: "Erişim", title: "Her rol kendi ekranını görür.", text: "Klinik sahibi operasyonu, fizyoterapist seans akışını, danışan ise kendi sürecini takip eder." },
  { label: "Hesap düzeni", title: "Tüm ekip üyeleri bir arada çalışır.", text: "Her ekip üyesi kendi hesabıyla çalışır; erişim görev alanına ve kullanıcı rolüne göre ayrılır." },
  { label: "Şeffaflık", title: "Yasal metinler erişilebilirdir.", text: "KVKK, gizlilik, kullanım şartları ve hesap silme süreçleri kullanıcıdan saklanmadan sunulur." },
  { label: "Kayıt bütünlüğü", title: "Klinik geçmişi bölünmez.", text: "Seans, paket, check-in ve ölçüm kayıtları danışan süreciyle bağlantılı biçimde güncel kalır." },
] as const;

export const productExplainers = [
  { role: "Yönetim merkezi", title: "Operasyon görünür olur", text: "Seans, paket, gelir ve ekip akışı yönetim ekranında birlikte okunur." },
  { role: "Ekip operasyonu", title: "Seans sahada tamamlanır", text: "Günlük akış, danışan detayı ve check-in işlemi mobilde hazırdır." },
  { role: "Danışan deneyimi", title: "Süreç danışana görünür", text: "Yaklaşan seans, kalan hak, ölçüm ve gelişim bilgisi uygulamada takip edilir." },
] as const;

export const comparisonItems = [
  { scattered: "WhatsApp konuşmaları", flow: "Tek danışan kaydı", result: "Not, paket ve seans geçmişi aynı dosyada kalır." },
  { scattered: "Excel paket takibi", flow: "Otomatik kalan hak", result: "Check-in işlendiğinde hak bilgisi güncel görünür." },
  { scattered: "Dekont ve manuel kontrol", flow: "Yönetici onay akışı", result: "Ödeme ve paket talebi karar ekranına düşer." },
  { scattered: "Ekibe ayrı bilgi verme", flow: "Günlük uzman ekranı", result: "Fizyoterapist sıradaki seansı ve danışan bilgisini görür." },
  { scattered: "Danışanın tekrar tekrar yazması", flow: "Mobil danışan görünümü", result: "Yaklaşan seans, kalan hak ve ölçüm bilgisi uygulamadadır." },
] as const;

export const featuredScreens = [
  { role: "Klinik yönetimi", title: "Operasyon görünümü", text: "Günlük seans, ekip yoğunluğu ve paket durumu tek yönetim ekranında okunur.", image: "/product-screens/admin-dashboard.png", fallbackImage: "/product-screens/admin-dashboard.png" },
  { role: "Ekip operasyonu", title: "Sahada danışan dosyası", text: "Fizyoterapist aktif paket, katılım ve ölçüm bilgisini seans öncesinde görür.", image: "/product-screens/trainer-client-detail.png", fallbackImage: "/product-screens/trainer-home.png" },
  { role: "Check-in", title: "Hak düşümü", text: "QR veya MEM kod ile seans işlenir; kalan hak ve kayıt geçmişi güncellenir.", image: "/product-screens/trainer-checkin.png", fallbackImage: "/product-screens/trainer-checkin.png" },
  { role: "Danışan deneyimi", title: "Kalan hak ve ölçüm", text: "Danışan yaklaşan seansını, paket hakkını ve gelişim kayıtlarını mobilde takip eder.", image: "/product-screens/member-package.png", fallbackImage: "/product-screens/member-home.png" },
] as const;

export const faqItems = [
  { question: "Fizyoflow kimler için geliştirilmiştir?", answer: "Fizyoflow; fizyoterapi klinikleri, klinik pilates hizmeti veren merkezler ve danışan seanslarını paket hakkı ile takip eden sağlık odaklı ekipler için geliştirilmiştir." },
  { question: "Paket hakkı nasıl takip edilir?", answer: "Seans veya grup dersi check-in ile işlendiğinde ilgili danışanın paket hakkı güncellenir. Yönetici kalan hak, paket geçmişi ve yenileme ihtiyacını aynı sistemde görür." },
  { question: "Fizyoterapist check-in akışı nasıl çalışır?", answer: "Fizyoterapist günlük seanslarını mobilde görür; QR veya manuel kod ile katılımı işler. İşlenen check-in, danışan kaydı ve paket takibiyle birlikte güncel kalır." },
  { question: "Danışan uygulamada ne görür?", answer: "Danışan yaklaşan seansını, kalan paket hakkını, grup derslerini, bildirimlerini ve ölçüm geçmişini kendi mobil ekranından takip eder." },
  { question: "Fizyoflow Google Play'de var mı?", answer: "Fizyoflow iPhone için App Store'da yayındadır. Google Play sürümü yakında yayınlanacak şekilde planlanmıştır." },
] as const;

export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${WEB_BASE}/#organization`, name: "Fizyoflow", url: WEB_BASE, logo: `${WEB_BASE}/brand/fizyoflow-og.svg`, description: CANONICAL_DESCRIPTION, sameAs: [APP_STORE_URL] },
      { "@type": "WebSite", "@id": `${WEB_BASE}/#website`, name: "Fizyoflow", url: WEB_BASE, publisher: { "@id": `${WEB_BASE}/#organization` }, inLanguage: "tr-TR", description: CANONICAL_DESCRIPTION },
      {
        "@type": "SoftwareApplication", "@id": `${WEB_BASE}/#software`, name: "Fizyoflow", applicationCategory: "BusinessApplication", operatingSystem: "iOS, Web", description: CANONICAL_DESCRIPTION, url: WEB_BASE, downloadUrl: APP_STORE_URL, publisher: { "@id": `${WEB_BASE}/#organization` },
        offers: { "@type": "Offer", price: "0", priceCurrency: "TRY", availability: "https://schema.org/InStock" },
        featureList: ["Randevu ve seans takibi", "Paket ve kalan hak yönetimi", "Ekip ve fizyoterapist operasyonu", "QR check-in akışı", "Danışan mobil deneyimi", "Gelir ve seans raporları", "Ölçüm geçmişi", "Rol bazlı erişim"],
        screenshot: [`${WEB_BASE}/product-screens/admin-dashboard.png`, `${WEB_BASE}/product-screens/trainer-checkin.png`, `${WEB_BASE}/product-screens/member-package.png`],
        softwareHelp: `${WEB_BASE}/#demo`,
      },
      { "@type": "FAQPage", "@id": `${WEB_BASE}/#faq`, mainEntity: faqItems.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
      { "@type": "BreadcrumbList", "@id": `${WEB_BASE}/#breadcrumb`, itemListElement: [{ "@type": "ListItem", position: 1, name: "Fizyoflow", item: WEB_BASE }] },
    ],
  };
}
