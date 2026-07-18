export const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
export const APP_STORE_URL = "https://apps.apple.com/tr/app/fizyoflow/id6771870032?l=tr";
export const CANONICAL_DESCRIPTION = "FizyoFlow, fizyoterapi ve klinik pilates merkezleri için randevu, paket, danışan, uzman, QR ve gelir/seans takibini tek mobil akışta birleştiren klinik yönetim platformudur.";

export const screenGroups = [
  {
    role: "Klinik",
    fallbackImage: "/product-screens/admin-dashboard.png",
    summary: "Klinik sahibi seans, paket, ödeme ve uzman yoğunluğunu aynı merkezden takip eder.",
    screens: [
      { label: "Yönetim merkezi", detail: "Günün seans, danışan ve operasyon özeti", image: "/product-screens/admin-dashboard.png" },
      { label: "Salon takvimi", detail: "Bireysel seanslar ve grup dersleri tek akışta", image: "/product-screens/admin-calendar.png" },
      { label: "Kişi yönetimi", detail: "Danışan ve uzman kayıtlarını filtreleyerek takip", image: "/product-screens/admin-members.png" },
      { label: "Danışan detayı", detail: "Paket, katılım ve ölçüm geçmişine toplu bakış", image: "/product-screens/admin-member-detail.png" },
      { label: "Paket yönetimi", detail: "Hizmet, fiyat, hak ve uzman eşleştirmesi", image: "/product-screens/admin-packages.png" },
      { label: "Gelir detayı", detail: "Gerçekleşen gelir, dönem dağılımı ve ay sonu tahmini", image: "/product-screens/admin-revenue-detail.png" },
    ],
  },
  {
    role: "Uzman",
    fallbackImage: "/product-screens/trainer-home.png",
    summary: "Uzman günlük seanslarını, danışan bilgisini ve check-in işlemini cebinden yürütür.",
    screens: [
      { label: "Bugünkü seanslar", detail: "Günün seansları, bekleyen işlemler ve hızlı aksiyonlar", image: "/product-screens/trainer-home.png" },
      { label: "Uzman takvimi", detail: "Seans programı ve ders yoğunluğunun günlük görünümü", image: "/product-screens/trainer-calendar.png" },
      { label: "Danışanlarım", detail: "Aktif danışanları arama, filtreleme ve hızlı erişim", image: "/product-screens/trainer-clients.png" },
      { label: "Check-in", detail: "QR veya kodla katılım ve hak düşümü", image: "/product-screens/trainer-checkin.png" },
      { label: "Grup dersleri", detail: "Ders programı, kapasite ve katılımcı akışı", image: "/product-screens/trainer-group-classes.png" },
      { label: "Danışan detayı", detail: "Aktif paket, kalan hak, katılım ve ölçüm bilgilerine toplu bakış", image: "/product-screens/trainer-client-detail.png" },
    ],
  },
  {
    role: "Danışan",
    fallbackImage: "/product-screens/member-home.png",
    summary: "Danışan yaklaşan seansını, kalan hakkını ve paket geçmişini uygulamada takip eder.",
    screens: [
      { label: "Danışan ana ekranı", detail: "Sonraki seans, kalan hak ve günlük özet", image: "/product-screens/member-home.png" },
      { label: "Ders takvimi", detail: "Yaklaşan bireysel seans ve grup derslerini görüntüleme", image: "/product-screens/member-calendar.png" },
      { label: "Paket ve haklar", detail: "Kalan kullanım, geçmiş ve ödeme bilgisi", image: "/product-screens/member-package.png" },
      { label: "Ölçümlerim", detail: "Vücut ölçümlerini ve kayıt geçmişini izleme", image: "/product-screens/member-measurements.png" },
      { label: "Gelişim", detail: "Katılım, paket kullanımı ve ölçüm trendini birlikte takip", image: "/product-screens/member-progress.png" },
      { label: "Grup dersleri", detail: "Uygun dersleri, kontenjanı ve katılım durumunu görme", image: "/product-screens/member-group-classes.png" },
    ],
  },
] as const;

export const trustItems = [
  { label: "Erişim", title: "Her rol kendi ekranını görür.", text: "Klinik sahibi operasyonu, uzman seans akışını, danışan ise kendi sürecini takip eder." },
  { label: "Hesap düzeni", title: "Tüm uzmanlar bir arada çalışır.", text: "Her uzman kendi hesabıyla çalışır; erişim görev alanına ve kullanıcı rolüne göre ayrılır." },
  { label: "Şeffaflık", title: "Yasal metinler erişilebilirdir.", text: "KVKK, gizlilik, kullanım şartları ve hesap silme süreçleri kullanıcıdan saklanmadan sunulur." },
  { label: "Kayıt bütünlüğü", title: "Klinik geçmişi bölünmez.", text: "Seans, paket, check-in ve ölçüm kayıtları danışan süreciyle bağlantılı biçimde güncel kalır." },
] as const;

export const productExplainers = [
  { role: "Klinik", title: "Operasyon görünür olur", text: "Seans, paket, gelir ve uzman akışı yönetim ekranında birlikte okunur." },
  { role: "Uzman", title: "Seans sahada tamamlanır", text: "Günlük akış, danışan detayı ve check-in işlemi mobilde hazırdır." },
  { role: "Danışan", title: "Süreç danışana görünür", text: "Yaklaşan seans, kalan hak, ölçüm ve gelişim bilgisi uygulamada takip edilir." },
] as const;

export const comparisonItems = [
  { scattered: "WhatsApp konuşmaları", flow: "Tek danışan kaydı", result: "Not, paket ve seans geçmişi aynı dosyada kalır." },
  { scattered: "Excel paket takibi", flow: "Otomatik kalan hak", result: "Check-in işlendiğinde hak bilgisi güncel görünür." },
  { scattered: "Dekont ve manuel kontrol", flow: "Klinik onay akışı", result: "Ödeme ve paket talebi klinik sahibinin karar ekranına düşer." },
  { scattered: "Uzmana ayrı bilgi verme", flow: "Günlük uzman ekranı", result: "Uzman sıradaki seansı ve danışan bilgisini görür." },
  { scattered: "Danışanın tekrar tekrar yazması", flow: "Mobil danışan görünümü", result: "Yaklaşan seans, kalan hak ve ölçüm bilgisi uygulamadadır." },
] as const;

export const faqItems = [
  { question: "FizyoFlow kimler için geliştirilmiştir?", answer: "FizyoFlow; fizyoterapi klinikleri, klinik pilates hizmeti veren merkezler ve danışan seanslarını paket hakkı ile takip eden sağlık odaklı ekipler için geliştirilmiştir." },
  { question: "Paket hakkı nasıl takip edilir?", answer: "Seans veya grup dersi check-in ile işlendiğinde ilgili danışanın paket hakkı güncellenir. Klinik sahibi kalan hak, paket geçmişi ve yenileme ihtiyacını aynı sistemde görür." },
  { question: "Uzman check-in akışı nasıl çalışır?", answer: "Uzman günlük seanslarını mobilde görür; QR veya manuel kod ile katılımı işler. İşlenen check-in, danışan kaydı ve paket takibiyle birlikte güncel kalır." },
  { question: "Danışan uygulamada ne görür?", answer: "Danışan yaklaşan seansını, kalan paket hakkını, grup derslerini, bildirimlerini ve ölçüm geçmişini kendi mobil ekranından takip eder." },
  { question: "FizyoFlow Google Play'de var mı?", answer: "FizyoFlow iPhone için App Store'da yayındadır. Google Play sürümü yakında yayınlanacak şekilde planlanmıştır." },
] as const;

export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${WEB_BASE}/#organization`, name: "FizyoFlow", url: WEB_BASE, logo: `${WEB_BASE}/brand/fizyoflow-og.svg`, description: CANONICAL_DESCRIPTION, sameAs: [APP_STORE_URL] },
      { "@type": "WebSite", "@id": `${WEB_BASE}/#website`, name: "FizyoFlow", url: WEB_BASE, publisher: { "@id": `${WEB_BASE}/#organization` }, inLanguage: "tr-TR", description: CANONICAL_DESCRIPTION },
      {
        "@type": "SoftwareApplication", "@id": `${WEB_BASE}/#software`, name: "FizyoFlow", applicationCategory: "BusinessApplication", operatingSystem: "iOS, Web", description: CANONICAL_DESCRIPTION, url: WEB_BASE, downloadUrl: APP_STORE_URL, publisher: { "@id": `${WEB_BASE}/#organization` },
        offers: { "@type": "Offer", price: "0", priceCurrency: "TRY", availability: "https://schema.org/InStock" },
        featureList: ["Randevu ve seans takibi", "Paket ve kalan hak yönetimi", "Klinik ve uzman operasyonu", "QR check-in akışı", "Danışan mobil deneyimi", "Gelir ve seans raporları", "Ölçüm geçmişi", "Rol bazlı erişim"],
        screenshot: [`${WEB_BASE}/product-screens/admin-dashboard.png`, `${WEB_BASE}/product-screens/trainer-checkin.png`, `${WEB_BASE}/product-screens/member-package.png`],
        softwareHelp: `${WEB_BASE}/#demo`,
      },
      { "@type": "FAQPage", "@id": `${WEB_BASE}/#faq`, mainEntity: faqItems.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
      { "@type": "BreadcrumbList", "@id": `${WEB_BASE}/#breadcrumb`, itemListElement: [{ "@type": "ListItem", position: 1, name: "FizyoFlow", item: WEB_BASE }] },
    ],
  };
}
