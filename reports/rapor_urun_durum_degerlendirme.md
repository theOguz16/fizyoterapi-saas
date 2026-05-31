# FizyoFlow Urun Durum Degerlendirme Raporu

Tarih: 2026-05-20  
Kapsam: mobil uygulama uc rol, backend API, web ana tanitim sitesi, klinik/subdomain web sitesi  
Kapsam disi: admin-web arayuzu gezilmedi ve urun yorumu yapilmadi.

## 1. Inceleme Yontemi

- Repo yapisi, mobil route gruplari, API controller/route katmani, web public sayfalari ve test kapsami incelendi.
- Lokal Postgres `fitnes-saas-postgres` ayaga kaldirildi, demo seed calistirildi.
- Demo kullanicilariyla canli API login ve temel endpoint kontrolleri yapildi:
  - Admin: `oguzhanuyar531@gmail.com / admin123`
  - Trainer: `elisauyar@gmail.com / trainer123`
  - Member: `member@gmail.com / member123`
- Dogrulama komutlari:
  - `pnpm --filter @fitnes-saas/api test`: 57 dosya gecti, 1 dosyada 2 test basarisiz.
  - `pnpm --filter @fitnes-saas/mobile test`: 34 dosya, 125 test basarili.
  - `pnpm --filter @fitnes-saas/api typecheck`: basarili.
  - `pnpm --filter @fitnes-saas/mobile typecheck`: basarili.
  - `pnpm --filter @fitnes-saas/web build`: basarili.
  - `pnpm --filter @fitnes-saas/web typecheck`: gercek typecheck degil, placeholder mesaj basiyor.

Not: Codex in-app browser localhost'u `ERR_BLOCKED_BY_CLIENT` ile engelledigi icin web arayuzunde gorsel gezinti HTML/curl, build ve kaynak incelemesiyle tamamlandi. `demo-salon.localhost` Host header ile lokal subdomain denemesi zaman asimina dustu; `/demo-salon` slug rotasi ve API verisi ayrica incelendi.

## 2. Genel Urun Ozeti

FizyoFlow mevcut haliyle bir MVP'den ileri seviyede: mobilde uye, egitmen ve yonetici icin ayrilmis yuzeyler var; backend cok sayida operasyonel modulu tasiyor; web tarafi hem ana pazarlama sitesi hem de klinik public vitrin modeline sahip. Urun omurgasi dogru: randevu, paket, grup dersi, check-in, olcum, risk, QR, public vitrin ve lead toplama ayni platformda birlesiyor.

En guclu taraflar:

- Rol bazli mobil navigasyon net: member, trainer, admin ayri tab setleriyle calisiyor.
- Backend endpoint kapsamli ve test sayisi yuksek.
- Demo seed gercek urun anlatimi icin yeterli veri uretiyor.
- Public klinik sayfasi SEO, LocalBusiness JSON-LD, WhatsApp/telefon/harita/form CTA'larini dusunmus.
- Mobil unit testleri ve typecheck temiz.

En kritik riskler:

- Backend testlerinde grup dersi katilim is kurali kirmizi.
- Trainer mobil risk ekrani yanlis endpoint'e bagli: `/trainer/risk` 404 donuyor, backend gercek endpoint'i `/trainer/risk/members`.
- Web typecheck gercek kontrol yapmiyor; build gecse bile kalite kapisi zayif.
- Lokal subdomain host akisi testte zaman asimina dustu; production DNS/proxy tarafinda ozel dikkat gerekiyor.
- API seed ve server baslangicinda `pg` deprecation uyarisi var.
- Mobilde bazi typo uyumluluklari (`reasom`, `meaşurement`) kodda geriye donuk tolerans olarak kalmis; veri sozlesmesi disiplini bozulabilir.

## 3. Mobil Uygulama Durumu

### 3.1 Member Rolu

Gezilen/yapisi incelenen ana alanlar:

- Tablar: `Takvim`, `Paketim`, `Ana Sayfa`, `Olcumler`, `Profil`
- Detay akislari: `bookings`, `group-classes`, `plan`, `attendance`, `booking/[id]`, `measurement/[id]`, `referrals`, `qr/fullscreen`, `campaigns`, `progress`

Canli API durumu:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `MEMBER_HOME`
- Mobil aksiyonlar: `VIEW_PACKAGES`, `CREATE_CHANGE_REQUEST`, `SHOW_QR`
- `/member/home`: 200, aktif paket 2, kalan kredi 18, yaklasan booking ve olcum verisi var.
- `/member/packages`: 6 public paket donuyor.
- `/member/bookings`: 2 booking donuyor.
- `/member/group-classes`: 1 grup dersi donuyor.
- `/member/measurements`: 3 olcum donuyor.
- `/member/attendance/history`: 2 kayit donuyor.
- `/member/referrals`: 1 referral kaydi donuyor.

Kullanilabilirlik:

- Member ana sayfasi urun olarak zengin: aktif paket, bekleyen onay, dersler, grup dersi, olcum trendi, katilim ve kampanya gibi sinyaller var.
- Uye icin asil deger onerisi iyi kurulmus: "Bugun ne var, paketim ne durumda, gelisimim nasil, QR/kayit nerede?"
- Mobilde aktif salon ile onboarding ayrimi dogru: aktif uye `(member)` grubuna, salon arayan/onboarding uye `(intake-member)` grubuna gidiyor.

Eksikler ve riskler:

- Member home dosyasinda typo fallback'leri var: `latest_meaşurement`, `meaşured_at`. Bu bug'i maskeleyebilir; backend ve mobile sozlesmesi netlestirilmeli.
- Grup dersi katilimi backend testlerinde kirmizi oldugu icin member tarafinda "katil", "bekleyen talep", "kontenjan dolu", "ders basladi" gibi hata durumlari yanlis mesajlanabilir.
- Takvim/schedule change request akisi genis query invalidation listelerine dayaniyor. Calisir ama ileride performans ve gereksiz refetch maliyeti yaratabilir.
- Member web surface `available_surfaces.web=false`; bu bilerek yapildiysa sorun degil, ama uye icin web portal planlanacaksa auth policy simdiden ayrilmali.

Oncelik onerileri:

1. Grup dersi katilim is kurali testlerini yesile cek.
2. Typo fallback'leri temizlemeden once backend sozlesmesine contract test ekle.
3. Member hata mesajlarini endpoint hata kodlarina gore urun dilinde ayir: bekleyen talep, kontenjan, baslamis ders, paket yok.
4. Paket/booking/olcum ekranlarinda bos veri ve gecmis veri deneyimlerini ayrica test et.

### 3.2 Trainer Rolu

Gezilen/yapisi incelenen ana alanlar:

- Tablar: `Takvim`, `Danisanlar`, `Ana Sayfa`, `Kazanc`, `Profil`
- Detay akislari: `today`, `packages`, `qr`, `bookings`, `checkin`, `members`, `members/[id]`, `risk`, `notes`, `note-edit`, `group-classes`

Canli API durumu:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `TRAINER_HOME`
- Mobil aksiyonlar: `CHECKIN`, `VIEW_SCHEDULE`, `VIEW_EARNINGS`
- Scan capability: `TRAINER_CHECKIN`
- `/trainer/today`: 200, o gun icin booking 0, haftalik session 2, check-in toplam 2.
- `/trainer/bookings`: 2 kayit donuyor.
- `/trainer/group-classes`: 1 grup dersi donuyor.
- `/trainer/members`: 1 danisan donuyor.
- `/trainer/qr`: 200.
- `/trainer/risk`: 404. Backend route `/trainer/risk/members`, mobil API `/trainer/risk` istiyor.

Kullanilabilirlik:

- Trainer home sade ve operasyonel: takvim, QR/yoklama, egitmen QR, paketler, kazanc, danisanlar, profil, grup dersleri hizli aksiyon olarak duruyor.
- Egitelemenin gunluk isi dusunulmus: bugunku ders, aylik gelir, riskli uye, check-in akisi.
- QR ve manuel check-in yuzeyi urun icin kritik ve dogru konumda.

Eksikler ve riskler:

- Risk ekrani su an canli endpoint ile kirik. Egitmen "Riskli danisanlar" ekranina girerse veri alamaz.
- Trainer home risk sayisini `/trainer/today` icinden gosteriyor, detay ekrani baska endpoint'e gidiyor; bu iki kaynak ayrisinca tutarsizlik riski var.
- Kazanc ekrani var ama finansal hesaplar, komisyon, iptal/iade, grup dersi paylasimi gibi edge case'ler daha fazla test ister.
- Egitmen takvimindeki schedule change request invalidation listeleri member/admin query'lerini de hedefliyor; merkezi cache invalidation politikasi daha temiz olmali.

Oncelik onerileri:

1. `getTrainerRiskApi()` endpoint'ini `/trainer/risk/members` yap veya backend'e `/trainer/risk` alias'i ekle.
2. Trainer risk ekranini E2E smoke'a ekle.
3. Kazanc hesaplari icin backend contract ve UI bos/veri yogun durum testleri ekle.
4. Check-in akisini offline/zayif baglanti ve tekrar okutma senaryolariyla guclendir.

### 3.3 Admin Rolu

Not: Kullanici admin-web'i gezmememi istedi; bu bolum mobil admin rolu icindir.

Gezilen/yapisi incelenen ana alanlar:

- Tablar: `Takvim`, `Onaylar`, `Ana Sayfa`, `Uyeler`, `Profil`
- Detay akislari: `salon`, `notifications`, `entry-scan`, `members/[id]`, `dashboard/risk-preview`, `dashboard/revenue-detail`, `approval/[id]`, `risk-members`, `campaigns`, `working-hours`, `pricing`, `packages`, `subscription`, `salon-profile`, `clinic-qr`, `salon/setup`

Canli API durumu:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `ADMIN_HOME`
- Mobil aksiyonlar: `VIEW_DASHBOARD`, `APPROVE_REQUESTS`, `SEND_NOTIFICATIONS`
- Scan capability: `SALON_ENTRY`
- `/admin/dashboard`: 200; aktif egitmen 1, aktif uye 5, riskli uye 4, bugunku ders 0, lead 2, paket 6, aylik gelir 2100.
- `/admin/mobile-approvals`: 0 kayit.
- `/admin/bookings`: 2 kayit.
- `/admin/members`: 5 uye.
- `/admin/packages`: 6 paket.
- `/admin/clinic/qr`: 200; join URL ve Detour URL uretiliyor.
- `/admin/clinic/subscription`: 200; `PUBLISHED`, `ACTIVE`.

Kullanilabilirlik:

- Mobil admin deneyimi cok genis kapsamli: dashboard, onay, giris tarama, takvim, uye, risk, paket, kampanya, dijital vitrin, gelir, salon ayarlari, QR.
- Gunluk operasyon ve yonetim araclari ayrimi iyi: sik kullanilanlar onde, daha seyrek ama kritik araclar ayrica.
- Salon QR ve public vitrin baglantisi urunun buyume tarafina iyi baglaniyor.

Eksikler ve riskler:

- Mobil admin kapsami cok genis; kucuk ekranda admin icin "her sey mobilde" hedefi karmaşa yaratabilir. Bazi detaylar admin-web'e, mobil ise hizli aksiyona odaklanmali.
- Dashboard'da riskli uye 4 iken onaylar 0; seed icin normal olabilir ama gercek kullanimda "neden riskli?" ve "hangi aksiyon?" daha belirgin olmali.
- Subscription ve salon setup akislari mobilde kritik para/kurulum kararlari tasiyor; purchase provider, trial, public yayinlama gibi durumlar daha fazla E2E ister.
- Admin QR payload'i `clinerva.godetour.link` base'i ile geliyor; marka FizyoFlow'a donmusken eski Clinerva izi production'da guven algisini bozabilir.

Oncelik onerileri:

1. Mobil admin'i "gunluk hizli operasyon" ve "derin ayarlar" diye net ayir.
2. Risk kartlarini aksiyonlanabilir hale getir: ara, not al, kampanya gonder, egitmene ata.
3. QR/Detour base URL marka ve ortam konfigurasyonlarini production preflight'a bagla.
4. Subscription, salon publish ve QR akislari icin E2E smoke zorunlu olsun.

## 4. Backend Degerlendirmesi

Backend Express + TypeORM + Postgres uzerinde kapsamli bir moduler yapiya sahip. Route ayrimi temiz: auth/public, admin, trainer, member, mobile, billing, internal alanlari belirgin.

Guclu taraflar:

- `/health`, `/live`, `/ready` var.
- Helmet, CORS, cookie parser, audit middleware, global rate limit kullaniliyor.
- Tenant ve role bazli route ayrimi genel olarak oturmus.
- Test kapsami yuksek: API testlerinde 172 testin 170'i gecti.
- Public salon, lead, event, QR, billing, mobile devices, risk, package, group class gibi urun cekirdegi endpoint'leri mevcut.
- Production startup config, script safety, runtime column maintenance gibi operasyonel kaygilar dusunulmus.

Kritik bulgular:

1. API test basarisizligi:
   - Dosya: `apps/api/tests/member-group-classes.controller.test.ts`
   - Basarisiz testler:
     - `detects existing queued join requests even when they are not the newest event`
     - `counts queued join requests against group class capacity`
   - Beklenen hata kodlari: `GROUP_CLASS_REQUEST_EXISTS`, `GROUP_CLASS_FULL`
   - Gelen hata kodu: `GROUP_CLASS_STARTED`
   - Koken neden: testlerde session tarihi `2026-05-12`; rapor tarihi `2026-05-20`. Controller once `session.starts_at <= Date.now()` kontrolu yapiyor. Bu hem testlerin zamana bagimli kirilmasi hem de hata onceligi tartismasi yaratiyor.

2. Mobil-backend endpoint sozlesmesi kirigi:
   - Mobil: `getTrainerRiskApi()` -> `/trainer/risk`
   - Backend: `/trainer/risk/members`
   - Sonuc: trainer risk ekrani 404.

3. Seed/server deprecation uyarisi:
   - `pg`: "Calling client.query() when the client is already executing a query is deprecated..."
   - Kisa vadede calisiyor, orta vadede pg 9 gecisinde sorun cikarabilir.

4. CORS default listesinde `http://localhost:3939` var ama `apps/api/.env` CORS_ORIGIN sadece `2929,3000,3001` iceriyor.
   - Lokal web form/API isteklerinde ortam env'i dogru verilmezse CORS sorunu cikabilir.

5. Runtime DB sync:
   - Development icin pratik; production'da migration disiplini gerekli.
   - `SchemaMaintenanceService.ensureRuntimeColumns` faydali ama uzun vadede migration yerine gecmemeli.

Gelistirme onerileri:

- API contract testlerini mobil API helper'lariyla eslestir: mobilde tanimli her endpoint backend route ile test edilmeli.
- Grup dersi katilim is kurallarinda hata onceligini urun karari olarak sabitle:
  - Once uye zaten talep etmis mi?
  - Kontenjan dolu mu?
  - Ders baslamis mi?
  - Paket/uyelik uygun mu?
- Zaman bagimli testlerde sabit clock kullan.
- `pg` deprecation kaynagini bulup parallel query akisini duzelt.
- Production icin CORS, TRUST_PROXY, JWT_SECRET, DB_SYNC, PUBLIC_WEB_BASE_URL, DETOUR_LINK_BASE_URL preflight kontrollerini genislet.

## 5. Web Ana Tanitim Sitesi

Incelenen dosyalar:

- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/components/demo-lead-form.tsx`
- `apps/web/app/globals.css`

Canli/build durumu:

- `pnpm --filter @fitnes-saas/web build` basarili.
- Ana sayfa HTML'i `http://localhost:3939/` uzerinden alindi.
- Sayfa title/description/OG/Twitter metadata var.
- JSON-LD `SoftwareApplication` var.
- Demo lead formu var.

Guclu taraflar:

- Ana mesaj net: mobil klinik operasyonu + web vitrini + SEO/Maps/lead.
- Urun gorselleri kullaniliyor; mobil ekran goruntuleriyle gercek urun hissi veriliyor.
- CTA'lar net: demo talep, klinik sayfasi, giris yap.
- KVKK/gizlilik/cerez/kullanim sartlari sayfalari mevcut.
- Demo formunda honeypot ve consent var.

Eksikler ve riskler:

- Web typecheck script'i gercek kontrol yapmiyor. Build typescript hatalarini yakalayabilir ama explicit typecheck kalite kapisi degil.
- Demo lead formunda timeout yok; klinik lead formunda 7 sn timeout var. Ana demo formunda da ayni davranis olmali.
- Demo formu KVKK metinlerine link vermiyor; metin "okuyabilirsiniz" diyor ama tiklanabilir degil.
- `APP_URL` default'u production `https://app.fizyoflow.com`; lokal veya staging'de yanlis yonlendirme riski var.
- Pazarlama dili guclu ama "fiyat", "kurulum suresi", "kimler icin degil", "pilot/onboarding sureci" gibi karar verdiren bilgiler az.
- OG image local HTML'de `http://localhost:3939/brand/fizyoflow-og.svg` olarak gorundu; production metadataBase dogruysa sorun olmaz, staging'de kontrol edilmeli.

Oneriler:

1. `apps/web` typecheck'i gercek `tsc --noEmit` yapacak hale getir.
2. Demo formuna timeout ve linkli KVKK/gizlilik metni ekle.
3. Ana sayfaya fiyat/plan veya "demo sonrasi kurulum adimlari" bolumu ekle.
4. Form submit sonrasi lead'in admin/internal ekranda gorundugunu smoke test ile dogrula.
5. SEO icin ana sayfada daha net lokasyon/hizmet long-tail bolumleri dusunulebilir.

## 6. Klinik/Subdomain Web Sitesi

Incelenen dosyalar:

- `apps/web/app/[salonSlug]/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/components/lead-form.tsx`
- `apps/web/components/public-event.tsx`
- `apps/web/app/join/[salonSlug]/page.tsx`

Canli API durumu:

- `/api/public/salons/demo-salon`: 200.
- Demo salon verisi SEO title, SEO description, business category, service area, WhatsApp, Google Maps, Instagram, gallery, services, business hours ve campaign bilgileri iceriyor.
- Klinik sayfasi LocalBusiness JSON-LD uretiyor.

Guclu taraflar:

- Public klinik sayfasi sadece statik landing degil; salon profili, hizmetler, galeri, iletisim, WhatsApp, telefon, harita ve lead formu var.
- CTA tracking var: page view, lead submit, WhatsApp, phone, map, Instagram, review.
- Lead formunda consent, honeypot ve 7 sn timeout var.
- Middleware subdomain rewrite mantigi dusunulmus: `demo-salon.fizyoflow.com` -> `/demo-salon`.
- Reserved subdomain listesi var.

Eksikler ve riskler:

- Lokal `demo-salon.localhost` Host header testi zaman asimina dustu. Bu production'i birebir kanitlamaz ama subdomain/proxy testleri otomasyona alinmali.
- `RESERVED_SUBDOMAINS` icinde `api`, `app`, `www` var ama `demo-salon.localhost` gibi lokal testlerde rewrite davranisi ayrica test edilmeli.
- Klinik sayfasinda hero image yoksa hero daha az guclu kalabilir; seed'de `hero_image_url=null`, galeri fallback var ama hero icin ilk galeri fallback'i kullaniliyor.
- WhatsApp numarasi sadece rakama indirgeniyor; TR disi veya hatali numara formatinda validasyon zayif kalabilir.
- Event tracking `keepalive` ile fire-and-forget; kritik lead/CTA raporlamasi icin backend tarafinda retry/batch veya analitik yedegi dusunulebilir.
- Join URL admin API'de `http://localhost:3939/join/demo-salon` olarak geliyor; production env dogru olmazsa QR basildiktan sonra geri donusu zor bir hata olur.

Oneriler:

1. Subdomain rewrite icin Playwright/Next middleware smoke testi yaz:
   - `Host: demo-salon.fizyoflow.com` -> `/demo-salon`
   - reserved hostlar rewrite olmamali.
2. QR join URL ve Detour fallback URL icin production preflight kontrolu ekle.
3. Klinik sayfasinda hero image zorunlulugu veya kaliteli fallback standardi belirle.
4. Lead form submit, event tracking ve admin lead listesi ucunu tek smoke testte bagla.
5. Klinik sayfalarinda canonical/subdomain, sitemap ve robots production'da elle test edilmeli.

## 7. Test ve Kalite Durumu

Basarili:

- Mobil unit testleri: 34/34 dosya, 125/125 test basarili.
- Mobil typecheck basarili.
- API typecheck basarili.
- Web build basarili.

Basarisiz/eksik:

- API testleri: 1 dosyada 2 test basarisiz.
- Web typecheck placeholder.
- Browser ile localhost gorsel test engellendi.
- Mobil E2E Maestro bu incelemede calistirilmadi; mevcut test dosyalari kapsamli gorunuyor ama rapor icin unit/API/live endpoint agirlikli ilerlenmistir.

Riskli kalite bosluklari:

- E2E rota uyusmazliklari unit testte yakalanmamis: trainer risk bunun ornegi.
- API zaman bagimli testler tarih ilerledikce kiriliyor.
- Production config dogrulama var ama web/subdomain/QR/Detour kombinasyonlari daha fazla preflight istiyor.

## 8. Onceliklendirilmis Aksiyon Listesi

P0 - Hemen:

1. `getTrainerRiskApi()` endpoint uyusmazligini duzelt.
2. Grup dersi katilim testlerini zamandan bagimsiz hale getir ve is kurali onceligini netlestir.
3. Web typecheck script'ini gercek typecheck yapacak sekilde degistir.
4. QR/Detour base URL'lerde `clinerva` izi ve localhost fallback riskini production config kontrolune al.

P1 - Kisa vade:

1. Mobilde member/trainer/admin icin kritik 3-5 route smoke E2E'yi CI'a koy.
2. Demo lead ve klinik lead formlarinin backend'e dustugunu test et.
3. Public subdomain middleware testlerini ekle.
4. `pg` deprecation uyarisi kaynagini cozumle.
5. Typo fallback alanlarini contract test ve migration planiyla temizle.

P2 - Urun iyilestirme:

1. Mobil admini daha net "hizli operasyon" odakli hale getir; derin ayarlari web/admin-web'e it.
2. Trainer kazanc ve risk ekranlarini daha aksiyonlanabilir yap.
3. Member paket/olcum/takvim ekranlarinda bos veri ve hata durumlarini tasarim diliyle guclendir.
4. Ana pazarlama sitesine fiyat/kurulum/pilot sureci gibi satin alma kararini hizlandiran bilgiler ekle.
5. Klinik public sayfasinda hero gorsel kalite standardi ve WhatsApp format validasyonu ekle.

## 9. Sonuc

Urunun cekirdegi kullanilabilir ve ciddi miktarda is akisi tamamlanmis durumda. Mobil tarafta uc rol de urun olarak anlamli bir deneyim sunuyor; backend moduler ve testli; web tarafinda pazarlama + public vitrin stratejisi dogru yerde.

Ancak production guveni icin su an en buyuk riskler sozlesme uyumsuzluklari ve kalite kapilari: trainer risk endpoint'i kirik, grup dersi katilim testi kirmizi, web typecheck gercek degil, subdomain/QR/Detour akislari otomatik smoke ile yeterince korunmuyor. Bunlar duzeltilirse urun hem demo hem pilot kullanim icin daha guvenli hale gelir.
