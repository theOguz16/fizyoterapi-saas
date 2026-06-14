# Fizyoflow Ana Sayfa Revizyon Raporu

Tarih: 2026-06-10

## 1. Hedef

Fizyoflow ana sayfasi, fitness/pilates agirlikli algidan cikarak fizyoterapi klinikleri icin guven veren, modern ve urun odakli bir SaaS vitrini haline getirilmeli.

Yeni konumlandirma:

> Fizyoflow, fizyoterapi klinikleri icin randevu, hasta/danisan takibi, egzersiz ve olcum sureclerini mobil uygulama ile duzenleyen; klinigin web gorunurlugunu, public vitrinini ve lead akisini tek sistemde birlestiren modern klinik yonetim platformudur.

Ana sayfanin ilk ekranda vermesi gereken mesaj:

> Kliniginizin ic duzeni mobilde, hasta/danisan deneyimi ve web gorunurlugu tek Fizyoflow catisinda.

## 2. Mobil Uygulama Renk Paleti

Mobil uygulamadaki gercek token dosyasi `apps/mobile/src/theme/tokens.ts` icinden cikarilan renkler:

| Rol | Renk | Kullanim |
| --- | --- | --- |
| Arka plan | `#F8FAFB` | Genel sayfa zemini |
| Guclu arka plan | `#EEF6F0` | Hero alt gecisleri, soft bantlar |
| Yuzey | `#FFFFFF` | Kartlar, paneller, mockup zeminleri |
| Soft yuzey | `#F2F8F3` | Ikincil kartlar, rozetler |
| Kenar | `#E1EADF` | Kart cizgileri, bolum ayiricilar |
| Guclu kenar | `#AFC7B2` | Secili kart, hover, aktif durum |
| Ana metin | `#1F2937` | Baslik ve govde metni |
| Soluk metin | `#6B7280` | Aciklama, metadata |
| Ana marka | `#97BB9C` | Soft marka yesili |
| Guclu marka | `#6F9274` | CTA, aktif durum, vurgu |
| Marka soft | `#F4F9F4` | Hafif marka yuzeyleri |
| Guven mavisi | `#5DADE2` | Klinik guven, teknoloji, ikincil vurgu |
| Basari | `#22C55E` | Tamamlandi, gelisim, pozitif metrik |
| Uyari | `#F59E0B` | Dikkat isteyen durumlar |
| Tehlike | `#EF4444` | Risk, iptal, kritik durum |

Web tarafinda mevcut `apps/web/app/globals.css` degiskenleri mobil paletle uyumlu:

- `--bg: #f8fafb`
- `--surface: #ffffff`
- `--surface-soft: #f2f8f3`
- `--brand: #6f9274`
- `--brand-soft: #97bb9c`
- `--brand-pale: #edf5ee`
- `--brand-dark: #496c4f`
- `--accent: #5dade2`

Tasarim karari:

- Ana palette mobildeki dogal yesil korunmali.
- Siyah/neon fitness dili kullanilmamali.
- Ana his: temiz, sakin, klinik, guvenilir, dogal ve teknolojik.
- CTA rengi `#6F9274`; hover/gecislerde `#97BB9C`.
- Guven ve teknoloji detaylari icin `#5DADE2` cok dozunda kullanilmali.

## 3. Referans Analizi

### 3.1 Physitrack

URL: https://www.physitrack.com/

Neden onemli:

- Fizyoterapi odakli en yakin urun referansi.
- Egzersiz programi, hasta uygulamasi, agri/progres takibi, mesajlasma ve telehealth anlatimi var.
- Site, fizyoterapist ve hasta tarafini birlikte anlatiyor.

Fizyoflow'a alinacaklar:

- "Fizyoterapist icin" ve "danisan/hasta icin" ikili anlatim.
- Egzersiz/olcum/progres kartlari.
- Uygulama bildirimleri: "Egzersiz tamamlandi", "Agri seviyesi guncellendi", "Yeni mesaj".
- Hasta bagliligi ve takip vurgusu.

Kacinilacaklar:

- Cok fazla global claim ve buyuk sayisal iddia kullanmak.
- Fizyoflow henuz bu kadar klinik icerik kutuphanesi sunmuyorsa egzersiz kutuphanesi vaadini abartmak.

### 3.2 Hinge Health

URL: https://www.hingehealth.com/

Neden onemli:

- Premium digital health hissi guclu.
- "Pain relief", "virtual physical therapy", "guided exercise sessions", "3D motion tracking", "personalized programs" gibi net mesajlar kullaniyor.
- Hero ve carousel mantigi Fizyoflow ana sayfasi icin iyi bir referans.

Fizyoflow'a alinacaklar:

- Ilk ekranda hasta/danisan sonucuna dokunan mesaj.
- "Olculebilir iyilesme" ve "kisilestirilmis takip" dili.
- Hareketli kart/carousel ile program, olcum ve takip modullerini anlatmak.

Kacinilacaklar:

- Fizyoflow'u dogrudan tibbi tedavi saglayicisi gibi gostermek.
- "Tedavi eder", "iyilestirir" gibi medikal iddialari kontrolsuz kullanmak.

### 3.3 Jane App

URL: https://jane.app/

Neden onemli:

- Klinik/practice management yazilimini sicak, sade ve guven veren dille anlatiyor.
- Randevu, charting, faturalama, paket/uyelik, hasta uygulamasi ve mesajlasma gibi Fizyoflow'a yakin alanlar var.

Fizyoflow'a alinacaklar:

- "Klinikte herkesin gunu kolaylasir" anlatimi.
- Sade dashboard/mockup sunumu.
- Online randevu, paket, odeme ve ekip yonetimi dilini yumusatmak.

Kacinilacaklar:

- Fazla genel wellness dili. Fizyoflow daha net fizyoterapi klinigi odakli kalmali.

### 3.4 OneStep

URL: https://www.onestep.co/

Neden onemli:

- Hareketi klinik veriye donusturme anlatimi cok guclu.
- Gait, mobility, fall risk, progress gibi objektif olcum kavramlarini iyi konumlandiriyor.

Fizyoflow'a alinacaklar:

- "Her seans izlenebilir bir gelisim verisine donussun" fikri.
- Olcum kartlari, progres skorlari, hasta ilerleme cizgileri.
- Klinik sahibi icin finansal/operasyonel etki metrikleri.

Kacinilacaklar:

- Fizyoflow'da gercek hareket analizi yoksa "motion lab", "clinical-grade analysis" gibi teknik iddialar kullanilmamali.

### 3.5 SPRY

URL: https://www.sprypt.com/

Neden onemli:

- Rehab klinikleri icin EMR, intake, documentation, billing, patient engagement ve analytics akisini tek urun olarak anlatiyor.
- Operasyonel SaaS dili kuvvetli.

Fizyoflow'a alinacaklar:

- Ozellikleri "Intake / Takvim / Paket / Olcum / Hasta Bagliligi / Raporlama" gibi modullere ayirmak.
- Klinik sahibine idari yuk azalmasini gostermek.
- Metrik kartlari ve urun modulu sliderlari.

Kacinilacaklar:

- ABD sigorta/billing/EMR terminolojisini Turkiye pazari icin birebir kullanmak.

### 3.6 WebPT

URL: https://www.webpt.com/

Neden onemli:

- Fizyoterapi klinigi yazilimi icin ozellik kapsaminda kuvvetli benchmark.
- EMR, Home Exercise Program, Virtual Visits, Outcomes, Scheduling, Billing ve Analytics gibi yapilar var.

Fizyoflow'a alinacaklar:

- Ozellik mimarisi icin kontrol listesi.
- Randevu, takip, outcomes ve raporlamayi ayri deger onerileri olarak anlatmak.

Kacinilacaklar:

- Tasarim dili daha kurumsal ve kuru; Fizyoflow daha modern ve sicak kalmali.

### 3.7 Luna

URL: https://www.getluna.com/

Neden onemli:

- Hasta guveni ve fizyoterapist uzmanligi iyi anlatiliyor.
- "How it works", terapist kartlari, tedavi alanlari ve yorum carousel'i guclu.

Fizyoflow'a alinacaklar:

- Klinik/danisan yolculugu anlatimi.
- "Degerlendirme -> plan -> takip -> gelisim" akisi.
- Sosyal kanit ve uzmanlik kartlari.

Kacinilacaklar:

- Fizyoflow bir hizmet pazaryeri gibi konumlanmamali; kliniklerin kullandigi platform olarak kalmali.

### 3.8 Kinetisense

URL: https://www.kinetisense.com/

Neden onemli:

- 3D hareket, fonksiyonel olcum ve objektif raporlama dili guclu.
- Ekranlarda hareket verisi, skorlar ve rapor hissi var.

Fizyoflow'a alinacaklar:

- Olcum gecmisi ve progres ekranlarini daha premium gostermek.
- "Subjektif takip yerine gorunur gelisim" mesaji.

Kacinilacaklar:

- 3D motion capture iddiasi, urunde yoksa kullanilmamali.

## 4. Ana Sayfa Icin Yeni Hikaye

Mevcut ana sayfada guclu taraflar:

- Mobil urun ekranlari var.
- Marka renkleri mobil uygulamayla uyumlu.
- Public vitrin, SEO, Maps ve lead takibi anlatiliyor.
- Teknik SEO icin JSON-LD ve FAQ yapisi dusunulmus.

Revizyon ihtiyaci:

- Hero gorseli ve metinleri halen klinik pilates/fitness hissine yakin.
- Fizyoterapi kliniginin asil derdi daha net yakalanmali: hasta/danisan takibi, seans sureci, olcum, egzersiz, randevu, paket, ekip ve web gorunurlugu.
- "Dijital vitrin" anlatimi korunmali ama ana mesaj sadece web sitesi degil, "klinik isletim sistemi + hasta deneyimi + gorunurluk" olmali.

Yeni ana anlatim:

> Fizyoflow, fizyoterapi kliniginizin operasyonunu mobilde duzenler; hasta yolculugunu takip edilebilir hale getirir; kliniginizin web vitrini ve lead akisini ayni marka diliyle yonetir.

## 5. Onerilen Ana Sayfa Bolum Sirasi

### 5.1 Hero

Amaç: Ilk 5 saniyede "bu urun fizyoterapi klinikleri icin" dedirtmek.

Baslik onerileri:

1. "Fizyoterapi kliniğinizin günlük akışı tek ekranda."
2. "Randevu, danışan takibi ve ölçümler Fizyoflow'da düzenlenir."
3. "Kliniğinizin iç düzeni mobilde, görünürlüğü web'de güçlenir."

Alt metin onerisi:

> Fizyoflow; fizyoterapi klinikleri için randevu, paket, danışan, ekip ve ölçüm takibini mobil uygulamada toplar. Public klinik vitrini, WhatsApp, telefon, harita ve form aksiyonlarıyla yeni danışan akışını ölçülebilir hale getirir.

Hero gorsel karari:

- Mevcut `fizyoflow-pilates-iphone-hero.png` yerine fizyoterapi/klinik hissi daha guclu bir gorsel kullanilmali.
- Hero'da mutlaka gercek urun ekranlari gorunmeli: admin dashboard, takvim, danisan/olcum ekrani.
- Arka plan cok koyu olmamali; mobil palete uygun `#EEF6F0` ve `#F8FAFB` tabanli ferah sahne daha dogru.

Hero mikro kartlari:

- "Bugünkü randevular"
- "Ölçüm bekleyen danışan"
- "Paket yenileme sinyali"
- "WhatsApp lead"

CTA:

- Birincil: "Demo Talep Et"
- Ikincil: "Örnek Klinik Sayfasını Gör"

### 5.2 Problem Bolumu

Baslik:

> Klinik büyüdükçe takip dağılır.

Kartlar:

- Randevular farkli yerde kalir.
- Paket ve seans hakki manuel takip edilir.
- Olcum gecmisi duzenli gorulmez.
- Web ve WhatsApp taleplerinin kaynagi belirsizlesir.

Animasyon:

- Dagilan notlar/kanallar once ayri kartlar olarak gorunur, scroll ile Fizyoflow panelinde birlesir.

### 5.3 Cozum Bolumu

Baslik:

> Fizyoflow klinik akışını tek ritme toplar.

Uc ana kolon:

1. Klinik operasyonu: randevu, paket, ekip, danışan.
2. Fizyoterapi takibi: ölçüm, gelişim, egzersiz/program notları.
3. Dijital büyüme: public vitrin, WhatsApp, telefon, harita, form.

Animasyon:

- Uc kolon sirasiyla aktif olur; sag taraftaki telefon mockup'i ilgili ekrana gecer.

### 5.4 Hasta/Danisan Yolculugu Slider'i

Baslik:

> Değerlendirmeden gelişim raporuna kadar takip edilebilir süreç.

Adimlar:

1. İlk temas
2. Değerlendirme
3. Planlama
4. Seans takibi
5. Ölçüm
6. Devam/yenileme

Her adim icin kisa metin:

- İlk temas: WhatsApp, form, telefon veya klinik vitrini.
- Değerlendirme: danışan profili ve başlangıç notları.
- Planlama: randevu ve paket akışı.
- Seans takibi: katılım, ödeme, eğitmen/fizyoterapist notu.
- Ölçüm: gelişim geçmişi ve karşılaştırma.
- Devam: paket yenileme ve takip aksiyonları.

### 5.5 Ürün Modülleri

Baslik:

> Fizyoterapi kliniği için gereken temel akışlar.

Moduller:

- Randevu ve takvim
- Danışan profili
- Paket ve seans hakkı
- Ölçüm geçmişi
- Ekip/fizyoterapist yönetimi
- Public klinik vitrini
- Lead takibi
- Raporlama

UI:

- Yatay tab/slider.
- Her tab'da ilgili mobil ekran veya mockup.
- Ikincil metinler kisa olmali.

### 5.6 Dijital Vitrin

Baslik:

> Her klinik için güven veren public sayfa.

Metin:

> Klinik adı, hizmetler, uzmanlık alanları, konum, çalışma saatleri, WhatsApp, telefon ve harita bağlantısı tek paylaşılabilir adreste birleşir.

Onerilen URL ornegi:

> atlasfizyo.fizyoflow.com

Vitrin icinde gosterilecek alanlar:

- Klinik adi
- Lokasyon
- Hizmetler
- Fizyoterapist/ekip
- Galeri
- WhatsApp CTA
- Harita
- Form

### 5.7 Güven ve Klinik Ciddiyet

Baslik:

> Klinik verisi sade, güvenli ve erişilebilir kalır.

Vurgular:

- Rol bazlı erişim
- Mobil kullanım
- Ölçülebilir CTA
- SEO ve teknik yayın düzeni
- KVKK ve kullanım sözleşmesi linkleri

Not:

- HIPAA gibi ABD odakli regülasyonlar Turkiye hedefleniyorsa kullanılmamalı.
- KVKK dili sade tutulmali.

### 5.8 Sosyal Kanıt / Pilot Klinik

Eger gercek referans yoksa:

- "Pilot kliniklerle kontrollü kurulum"
- "Kurulum görüşmesi"
- "Vitrin hazırlığı"
- "İlk lead ölçümü"

Gercek referans geldikten sonra:

- Klinik logosu
- Kisa yorum
- Once/sonra operasyon metrikleri

### 5.9 Paket / Demo Bolumu

Baslik:

> Kliniğinizin akışına göre doğru başlangıç planını birlikte çıkaralım.

Paketler:

- Pilot Klinik
- Büyüme Paketi
- Çoklu Ekip

CTA:

- "Demo Talep Et"
- "Klinik Bilgilerini Paylaş"

## 6. Animasyon ve Etkilesim Planı

Tasarim prensibi:

- Animasyonlar "premium" hissettirmeli ama klinik güveni bozacak kadar oyuncak olmamali.
- Hareketler yavas, yumusak, okunabilir olmali.
- Mobilde performans icin kompleks parallax azaltilmali.

Onerilen animasyonlar:

1. Hero ürün ekranı geçişi
   - Dashboard -> Takvim -> Danışan/Ölçüm ekranı.
   - 4-5 saniyelik sakin loop.

2. Hasta yolculuğu progress line
   - Scroll ile adımlar aktifleşir.
   - Aktif adımda telefon ekranı değişir.

3. Özellik modülü slider'ı
   - Tab tıklanınca ekran ve metin yumuşak fade/slide ile değişir.

4. Metrik sayaçları
   - "WhatsApp", "Telefon", "Harita", "Form" aksiyonları küçük sayaç kartlarında canlanır.

5. Egzersiz / ölçüm kartları
   - Kartlar yatay akar; hover veya scroll ile detay görünür.

6. Public vitrin preview
   - Mini tarayıcı içinde klinik sayfası scroll simülasyonu.

Kacinilacak animasyonlar:

- Asiri hizli marquee.
- Koyu neon glow.
- Fitness uygulamasi gibi agresif enerji.
- Gorsel alanlarda stok foto ile abarti parallax.

## 7. Görsel Varlık İhtiyacı

Mevcut web assetleri:

- `/brand/fizyoflow-mark.svg`
- `/brand/fizyoflow-logo.svg`
- `/product-screens/admin-dashboard.png`
- `/product-screens/admin-calendar.png`
- `/product-screens/admin-members.png`
- `/product-screens/fizyoflow-iphone-hero.png`
- `/product-screens/fizyoflow-pilates-iphone-hero.png`

Eksik/önerilen yeni assetler:

1. Fizyoterapi odaklı hero görseli
   - Klinik ortam, terapist/danışan, doğal ışık, premium ama gerçekçi.
   - Pilates reformer ağırlığı azaltılmalı.

2. Ölçüm ekranı mockup'ı
   - Mobilde varsa gerçek ekran görüntüsü kullanılmalı.
   - Yoksa ürün mockup olarak hazırlanmalı.

3. Danışan profili ekranı
   - Randevu geçmişi, paket, ölçüm, notlar.

4. Public klinik sayfası preview görseli
   - `atlasfizyo.fizyoflow.com` gibi örnek sayfa mockup'ı.

5. Lead takip dashboard'u
   - WhatsApp, telefon, harita, form tıklamaları.

## 8. Önerilen Metin Seti

### Hero

Eyebrow:

> Fizyoterapi klinikleri için mobil klinik yönetimi

H1:

> Kliniğinizin randevu, danışan ve ölçüm akışı tek yerde.

Lead:

> Fizyoflow; fizyoterapi klinikleri için randevu, paket, danışan, ekip ve ölçüm takibini mobilde düzenler. Public klinik vitrini ve WhatsApp, telefon, harita, form aksiyonlarıyla yeni danışan akışını ölçülebilir hale getirir.

CTA:

> Demo Talep Et

Ikincil CTA:

> Örnek Klinik Sayfasını Gör

### Problem

Baslik:

> Klinik büyüdükçe takip dağılmasın.

Metin:

> Randevular, paket hakları, ölçüm notları, ekip yoğunluğu ve gelen talepler farklı kanallara dağıldığında klinik ritmi yavaşlar. Fizyoflow bu akışı sade ve takip edilebilir hale getirir.

### Çözüm

Baslik:

> Mobil uygulama içeride düzen kurar, web vitrini dışarıda güven verir.

### Hasta Yolculuğu

Baslik:

> Danışan yolculuğu ilk temastan gelişim takibine kadar görünür.

### Ölçüm

Baslik:

> Gelişim sadece hissedilmez, takip edilir.

Metin:

> Ölçüm geçmişi, seans katılımı ve paket kullanımı aynı danışan profili içinde düzenli görünür. Klinik ekibi bir sonraki aksiyonu daha rahat planlar.

### Dijital Vitrin

Baslik:

> Kliniğinizin paylaşılabilir, güven veren web vitrini hazır olur.

Metin:

> Hizmetler, konum, çalışma saatleri, harita, WhatsApp ve form aksiyonları tek public sayfada toplanır. Klinik sayfanız Google ve sosyal medya trafiği için temiz bir ilk temas noktası olur.

## 9. SEO Önerisi

Ana title:

> Fizyoflow | Fizyoterapi Klinikleri İçin Mobil Yönetim ve Dijital Vitrin

Meta description:

> Fizyoflow, fizyoterapi klinikleri için randevu, danışan, paket, ekip ve ölçüm takibini mobilde düzenler; public klinik vitriniyle WhatsApp, telefon, harita ve form taleplerini ölçülebilir hale getirir.

H1:

> Kliniğinizin randevu, danışan ve ölçüm akışı tek yerde.

H2 önerileri:

- Klinik büyüdükçe takip dağılmasın.
- Fizyoflow klinik akışını tek ritme toplar.
- Danışan yolculuğu ilk temastan gelişim takibine kadar görünür.
- Her klinik için güven veren public sayfa.
- Kliniğinizin akışına göre doğru başlangıç planını birlikte çıkaralım.

Local SEO kelime grupları:

- fizyoterapi klinik yönetim yazılımı
- fizyoterapi randevu takip sistemi
- klinik pilates paket takip sistemi
- fizyoterapi danışan takip uygulaması
- fizyoterapi ölçüm takip yazılımı
- fizyoterapi kliniği dijital vitrin
- klinik WhatsApp lead takibi

## 10. Uygulama Öncelikleri

### Faz 1: Mesaj ve Hero Revizyonu

- H1 ve hero lead fizyoterapi odaklı yeniden yazılmalı.
- Pilates ağırlıklı hero görseli azaltılmalı veya fizyoterapi görseliyle değiştirilmeli.
- İlk ekranda randevu, danışan, ölçüm ve lead kartları gösterilmeli.

### Faz 2: Sayfa Akışı

- Problem bölümü eklenmeli.
- Hasta yolculuğu slider'ı eklenmeli.
- Ürün modülleri fizyoterapi klinik akışına göre yeniden sıralanmalı.
- Dijital vitrin bölümü korunmalı ama ana üründen sonra gelmeli.

### Faz 3: Görsel ve Animasyon

- Mobil ekran geçişleri sadeleştirilmeli.
- Public vitrin preview daha gerçekçi yapılmalı.
- Ölçüm/progres kartları eklenmeli.
- Hareketli ama sakin scroll reveal kullanılmalı.

### Faz 4: Dönüşüm ve SEO

- Demo formu fizyoterapi klinikleri için özelleştirilmeli.
- Form alanlarına "klinik türü", "ekip sayısı", "öncelikli ihtiyaç" eklenebilir.
- SEO title/description güncellenmeli.
- FAQ'lar fizyoterapi klinikleri ve dijital vitrin odağına çekilmeli.

## 11. Sonuç

Fizyoflow ana sayfası için en güçlü yön:

> Mobil uygulamadaki doğal yeşil, sakin ve güven veren marka dili korunarak; ana mesaj fitness/pilates yerine fizyoterapi kliniği operasyonu, danışan takibi, ölçüm ve dijital görünürlük üzerine yeniden kurulmalı.

En doğru referans kombinasyonu:

- Physitrack: fizyoterapi ürün mantığı
- Hinge Health: premium digital health anlatımı
- Jane App: sıcak klinik yazılım dili
- OneStep: ölçüm ve gelişim verisi
- SPRY/WebPT: operasyonel SaaS kapsamı
- Luna: hasta güveni ve yolculuk anlatımı

Ana sayfa revizyonunda renk paleti değiştirilmemeli; mobil uygulamanın `#6F9274`, `#97BB9C`, `#F2F8F3`, `#F8FAFB`, `#1F2937` renkleri korunmalı ve daha ferah bir fizyoterapi SaaS estetiğine taşınmalı.
