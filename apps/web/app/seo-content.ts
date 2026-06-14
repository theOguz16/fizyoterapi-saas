import type { SeoLandingContent } from "../components/seo-landing";

const APP_STORE_URL = "https://apps.apple.com/tr/app/fizyoflow/id6771870032?l=tr";

export const seoLandingPages: Record<string, SeoLandingContent & { metaTitle: string; metaDescription: string }> = {
  "fizyoterapi-klinik-yonetim-sistemi": {
    eyebrow: "Fizyoterapi klinik yönetim sistemi",
    title: "Fizyoterapi kliniklerinde seans, paket ve danışan takibi tek mobil akışta.",
    description: "Fizyoflow, fizyoterapi klinikleri için yönetici, fizyoterapist ve danışan ekranlarını aynı güncel kayıt üzerinden buluşturur.",
    metaTitle: "Fizyoterapi Klinik Yönetim Sistemi | Fizyoflow",
    metaDescription: "Fizyoflow; fizyoterapi klinikleri için seans, paket, check-in, ekip ve danışan takibini tek mobil yönetim sisteminde toplar.",
    image: "/product-screens/admin-dashboard.png",
    imageAlt: "Fizyoflow fizyoterapi klinik yönetim merkezi ekranı",
    outcomes: [
      "Klinik sahibi günlük seansları ve takip bekleyen işleri görür.",
      "Fizyoterapist kendi seans akışını mobilde takip eder.",
      "Danışan kalan hakkını ve yaklaşan seansını uygulamada görür.",
    ],
    sections: [
      {
        title: "Klinik operasyonu tek yerden okunur",
        text: "Fizyoflow; başvuru, seans planı, paket hakkı, ödeme durumu, check-in ve ölçüm geçmişini birbirine bağlar. Böylece klinik sahibi günlük akışı farklı mesajlar ve tablolar arasında aramak zorunda kalmaz.",
      },
      {
        title: "Üç rol aynı verinin kendi tarafını kullanır",
        text: "Yönetici operasyon özetini, fizyoterapist günlük seansını, danışan ise kendi seans ve paket bilgisini görür. Her rol aynı sistemde kalır ama yalnızca kendi işiyle ilgili ekranı kullanır.",
      },
    ],
    faq: [
      {
        question: "Fizyoflow hangi klinikler için uygundur?",
        answer: "Fizyoflow; fizyoterapi klinikleri, klinik pilates hizmeti veren merkezler ve seans-paket takibini düzenli yürütmek isteyen sağlık odaklı ekipler için uygundur.",
      },
      {
        question: "Fizyoflow sadece takvim uygulaması mı?",
        answer: "Hayır. Takvimle birlikte paket hakkı, check-in, danışan takibi, ölçüm geçmişi ve yönetim görünürlüğünü aynı akışta toplar.",
      },
    ],
  },
  "seans-paket-takibi": {
    eyebrow: "Seans ve paket takibi",
    title: "Seans işlendiğinde paket hakkı güncel kalır.",
    description: "Fizyoflow, danışanın katılımını, kalan paket hakkını, paket geçmişini ve yenileme ihtiyacını aynı kayıt üzerinde takip eder.",
    metaTitle: "Seans ve Paket Takibi Yazılımı | Fizyoflow",
    metaDescription: "Fizyoflow ile fizyoterapi kliniklerinde seans, paket hakkı, kalan hak, ödeme durumu ve paket yenileme takibi tek akışta ilerler.",
    image: "/product-screens/admin-packages.png",
    imageAlt: "Fizyoflow paket yönetimi ve kalan hak takibi ekranı",
    outcomes: [
      "Kalan hak manuel listelerde kaybolmaz.",
      "Paket bitişleri ve yenileme ihtiyacı görünür kalır.",
      "Ödeme ve paket durumu yönetim ekranında birlikte izlenir.",
    ],
    sections: [
      {
        title: "Paket hakkı seans akışına bağlanır",
        text: "Bir danışan seansa katıldığında check-in işlemi paket takibini de etkiler. Bu yapı, seans katılımı ve kalan hak bilgisinin farklı yerlerde tutulmasını azaltır.",
      },
      {
        title: "Yenileme ihtiyacı daha erken fark edilir",
        text: "Paket geçmişi, kalan hak ve bitiş bilgisi yönetici ekranında görünür kaldığı için takip gerektiren danışanlar daha kolay ayrışır.",
      },
    ],
    faq: [
      {
        question: "Paket hakkı otomatik düşer mi?",
        answer: "Check-in akışı işlendiğinde ilgili danışanın paket hakkı güncellenir. Yönetici kalan hak ve paket geçmişini aynı sistemde takip eder.",
      },
      {
        question: "Ek paket veya yenileme takibi yapılabilir mi?",
        answer: "Evet. Paket geçmişi, kalan hak ve yenileme ihtiyacı danışan ve yönetim ekranlarında görünür kalır.",
      },
    ],
  },
  "fizyoterapist-check-in": {
    eyebrow: "Fizyoterapist check-in uygulaması",
    title: "Fizyoterapist günlük seansını görür, katılımı mobilde işler.",
    description: "Fizyoflow, fizyoterapistin günlük akışını ve danışan check-in işlemini masa başına dönmeden tamamlamasına yardımcı olur.",
    metaTitle: "Fizyoterapist Check-in Uygulaması | Fizyoflow",
    metaDescription: "Fizyoflow ile fizyoterapistler günlük seanslarını görür, QR veya manuel kodla check-in işler ve paket hakkı güncel kalır.",
    image: "/product-screens/trainer-checkin.png",
    imageAlt: "Fizyoflow fizyoterapist check-in ekranı",
    outcomes: [
      "Fizyoterapist sıradaki danışanı mobilde görür.",
      "QR veya manuel kodla katılım işlenir.",
      "İşlenen seans yönetici ve danışan kayıtlarına yansır.",
    ],
    sections: [
      {
        title: "Günlük seans akışı fizyoterapistin cebinde olur",
        text: "Fizyoterapist bugünkü seanslarını, danışan bilgisini ve katılım işlemini mobil ekrandan takip eder. Bu sayede günlük akış sadece yönetim masasındaki takvimde kalmaz.",
      },
      {
        title: "Check-in paket takibiyle birlikte çalışır",
        text: "Katılım kaydı işlendiğinde ilgili seans, danışan ve paket bilgisi aynı sistemde güncellenir. Yönetici ayrıca tekrar bilgi girmek zorunda kalmaz.",
      },
    ],
    faq: [
      {
        question: "Check-in QR ile yapılabilir mi?",
        answer: "Evet. Fizyoflow check-in akışı QR veya manuel kod üzerinden katılım işlenmesini destekler.",
      },
      {
        question: "Fizyoterapist tüm klinik verisini görür mü?",
        answer: "Hayır. Rol bazlı deneyim sayesinde fizyoterapist kendi görev akışına uygun ekranları kullanır.",
      },
    ],
  },
  "danisan-takibi-olcum": {
    eyebrow: "Danışan ve ölçüm takibi",
    title: "Danışan yaklaşan seansını, kalan hakkını ve ölçüm geçmişini takip eder.",
    description: "Fizyoflow, danışan mobil deneyimini klinik operasyonuyla bağlar; seans, paket ve ölçüm bilgisi aynı akışta güncel kalır.",
    metaTitle: "Danışan ve Ölçüm Takibi | Fizyoflow",
    metaDescription: "Fizyoflow danışanların yaklaşan seansını, kalan paket hakkını, grup derslerini, ölçüm geçmişini ve yenileme ihtiyacını mobilde gösterir.",
    image: "/product-screens/member-package.png",
    imageAlt: "Fizyoflow danışan paket ve kalan hak takibi ekranı",
    outcomes: [
      "Danışan yaklaşan seansını uygulamada görür.",
      "Kalan paket hakkı ve paket geçmişi görünür kalır.",
      "Ölçüm geçmişi danışan takibinin parçası olur.",
    ],
    sections: [
      {
        title: "Danışan temel bilgileri tekrar tekrar sormaz",
        text: "Yaklaşan seans, kalan hak, grup dersleri ve bildirimler danışanın mobil ekranında yer alır. Klinik ekibi temel bilgi talepleriyle daha az bölünür.",
      },
      {
        title: "Ölçüm ve gelişim takibi operasyonla birlikte ilerler",
        text: "Ölçüm geçmişi, seans ve paket bilgisiyle aynı sistemde tutulduğu için danışan süreci daha düzenli takip edilir.",
      },
    ],
    faq: [
      {
        question: "Danışan kendi paket hakkını görebilir mi?",
        answer: "Evet. Danışan kalan hakkını, paket geçmişini ve yaklaşan seansını mobil uygulamada takip eder.",
      },
      {
        question: "Ölçüm takibi klinik ekibi tarafından görülebilir mi?",
        answer: "Ölçüm geçmişi danışan sürecinin parçası olarak sistemde tutulur ve rol bazlı erişimle ilgili kullanıcıların ekranında görünür.",
      },
    ],
  },
};

export { APP_STORE_URL };
