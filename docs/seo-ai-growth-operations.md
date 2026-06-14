# Fizyoflow SEO, AI ve Trafik Ölçüm Operasyonu

## İlk Kurulum

1. Google Search Console'da `fizyoflow.com` için Domain Property oluşturun.
2. Google'ın verdiği TXT kaydını DNS'e ekleyip doğrulayın.
3. `https://fizyoflow.com/sitemap.xml` adresini gönderin.
4. URL Inspection ile şu adresler için indeks isteyin:
   - `https://fizyoflow.com/`
   - `https://fizyoflow.com/fizyoterapi-klinik-yonetim-sistemi`
   - `https://fizyoflow.com/seans-paket-takibi`
   - `https://fizyoflow.com/fizyoterapist-check-in`
   - `https://fizyoflow.com/danisan-takibi-olcum`
5. Bing Webmaster Tools'a siteyi ekleyin ve aynı sitemap'i gönderin.

Domain Property yerine HTML doğrulaması kullanılacaksa doğrulama değerlerini sunucudaki `.env.production` dosyasına ekleyin:

```env
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=google-verification-value
NEXT_PUBLIC_BING_SITE_VERIFICATION=bing-verification-value
```

## GA4

Google Analytics'te bir web stream oluşturup Measurement ID değerini production env dosyasına yazın:

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Web container yeniden build edilmelidir. Analitik yalnızca kullanıcı cookie bildirimini kabul ettikten sonra çalışır.

Uygulamanın gönderdiği temel olaylar:

- `app_store_click`
- `demo_section_click`
- `demo_lead_submit`
- `faq_open`
- `product_gallery_interaction`
- `analytics_consent_granted`

GA4 DebugView ve Realtime ekranında olayları kontrol edin. UTM kampanyalarında en az `utm_source`, `utm_medium` ve `utm_campaign` kullanın.

## Düzenli Kontrol

- Search Console Coverage ve Page Indexing raporunu haftalık kontrol edin.
- Arama sorgularını ve düşük tıklama oranlı sayfaları aylık inceleyin.
- App Store, LinkedIn ve sosyal profillerde şu tanımı tutarlı kullanın:

  `Fizyoflow, fizyoterapi klinikleri için seans, paket, check-in, ekip ve danışan takibini tek mobil akışta toplayan yönetim sistemidir.`

- ChatGPT Search, Gemini ve Perplexity'de ayda bir şu sorguları kontrol edin:
  - `Fizyoflow nedir?`
  - `Fizyoterapi kliniği için paket takip uygulaması öner`
  - `Türkçe fizyoterapist check-in ve seans takip uygulaması`

AI sistemlerinde önerilme garanti edilemez. En güçlü sinyaller taranabilir özgün içerik, Search Console indeks durumu, App Store sayfası ve güvenilir dış kaynaklardaki tutarlı marka anlatımıdır.
