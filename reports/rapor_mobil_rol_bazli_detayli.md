# FizyoFlow Mobil Uygulama Rol Bazli Detayli Raporu

Tarih: 2026-05-21  
Kapsam: yalniz mobil uygulama; member, trainer ve admin rolleri  
Kapsam disi: web, admin-web, backend mimari yorumu. Backend sadece mobil ekranlari etkileyen endpoint/hata baglaminda anildi.

## 1. Kisa Cevap

Onceki raporda mobil bolum vardi ama yeterince derin degildi. Bu rapor mobil icin ayrica hazirlandi: uc rolun ekran envanteri, ana akislar, kullanilabilirlik durumu, eksikler, hatalar ve oncelikler burada toplandi.

Mobil uygulama genel olarak kullanilabilir bir seviyede. Rol bazli tab yapisi dogru kurulmus, ekran sayisi genis, API baglantilari buyuk olcude calisiyor. Fakat pilot/production oncesi giderilmesi gereken net mobil riskler var:

- Trainer risk ekrani su an kirik: mobil `/trainer/risk` istiyor, backend `/trainer/risk/members` sunuyor.
- Member grup dersi katilim akisi backend testlerinde kirmizi; mobilde yanlis hata mesaji veya yanlis buton durumu uretme riski var.
- Admin mobil kapsam cok buyuk; kucuk ekranda derin ayar/isletme yonetimi karmasiklasabilir.
- Bazi ekranlarda veri sozlesmesini maskeleyen typo fallback'leri var: `reasom`, `meaşurement`, `getPublıc...`.
- E2E kapsami var ama her kritik ekran icin "aciliyor, veri geliyor, ana aksiyon calisiyor" smoke kapisi daha sistematik olmali.

## 2. Genel Mobil Mimari ve Navigasyon

Mobil uygulama Expo Router ile rol bazli route gruplarina ayrilmis:

- Member aktif salon: `apps/mobile/app/(member)`
- Member onboarding/salon kesfi: `apps/mobile/app/(intake-member)`
- Trainer: `apps/mobile/app/(trainer)`
- Admin: `apps/mobile/app/(admin)`
- Ortak akuslar: `apps/mobile/app/(shared)`
- Auth/onboarding: `apps/mobile/app/(auth)`

Rol yonlendirme `apps/mobile/src/lib/navigation.ts` ve root gate icinde yapiliyor. Bu iyi bir tercih; kullanici login olduktan sonra role ve onboarding state'e gore dogru yuzeye atiliyor.

Ana guclu taraflar:

- Her rolde alt tab navigasyonu var.
- Detay ekranlari tab'den gizlenmis; ana ekranlardan push ediliyor.
- Ortak `AppShell`, `SurfaceCard`, `MetricCard`, `ActionButton`, `EmptyState` gibi componentler sayesinde UI dili tutarli.
- React Query kullanimi yaygin; pull-to-refresh ve mutation sonrasi invalidation dusunulmus.
- TestID kullanimi iyi seviyede; Maestro E2E icin altyapi var.

Ana mobil teknik riskler:

- Query invalidation listeleri bazi ekranlarda cok genis; bir aksiyon gereksiz cok ekrani refetch edebilir.
- Hata/bos/veri yukleniyor durumlari her ekranda ayni derinlikte degil.
- Bazi route map kayitlari eski veya hatali rota izlerini tasiyor; ornek: `(trainer)/manual-code` route map'te var ama dosya yok.
- Mobil API helper dosyasi cok buyumus; endpoint sozlesmeleri daginiklasmis.

## 3. Member Rolu

### 3.1 Ekran Envanteri

Ana tablar:

- `home`: uye ana sayfasi.
- `calendar`: takvim.
- `package`: paketim.
- `measurements`: olcumler.
- `profile`: profil.

Detay/ikincil ekranlar:

- `attendance`: katilim gecmisi.
- `bookings`: rezervasyon listesi.
- `booking/[id]`: rezervasyon detay/iptal.
- `campaigns`: kampanyalar.
- `group-classes`: grup dersleri.
- `measurement/[id]`: olcum ekleme/duzenleme.
- `plan`: haftalik hedef ve uygunluk.
- `progress`: ilerleme ozeti.
- `qr/fullscreen`: uye QR.
- `referrals`: arkadas daveti.

### 3.2 Ana Deneyim

Member ana sayfa urun olarak guclu. Uye ilk ekranda sunlari gorebiliyor:

- Aktif paket sayisi ve kalan kredi.
- Bekleyen saat degisikligi/onay talepleri.
- Siradaki ders.
- Aktif grup dersleri.
- Hizli aksiyonlar: paketim, takvim, olcumler, profil.
- Son olcum trendleri.
- Arkadas daveti.

Bu, uye icin dogru bir mobil ana ekran mantigi: "Bugun ne yapacagim, paketim ne durumda, gelisimim nasil?" sorularina cevap veriyor.

### 3.3 Canli Veri Durumu

Demo member ile yapilan kontrolde:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `MEMBER_HOME`
- Mobil aksiyonlar: `VIEW_PACKAGES`, `CREATE_CHANGE_REQUEST`, `SHOW_QR`
- Ana endpointler veri donuyor:
  - `/member/home`: aktif paket, kalan kredi, yaklasan booking, olcum.
  - `/member/packages`: public paketler.
  - `/member/bookings`: booking listesi.
  - `/member/group-classes`: grup dersi listesi.
  - `/member/measurements`: olcum gecmisi.
  - `/member/attendance/history`: katilim gecmisi.
  - `/member/referrals`: davet kayitlari.

### 3.4 Kullanilabilirlik Degerlendirmesi

Iyi noktalar:

- Ana sayfa zengin ama is odakli.
- Profil ekraninda QR, referral, salon ayrilma ve logout gibi temel aksiyonlar var.
- Paket ekraninda sadece aktif paket degil, public paketlerden tekrar satin alma yonlendirmesi de var.
- Plan ekraninda haftalik hedef ve uygunluk kaydi dusunulmus.
- Progress ekraninda olcum, paket ve katilim gecmisi ayni hikayeye baglaniyor.
- QR fullscreen ekrani pratik kullanim icin dogru.

Zayif noktalar:

- Member deneyimi cok fazla ikincil ekrana yayiliyor. `package`, `plan`, `progress`, `attendance`, `bookings`, `calendar` arasinda bilgi tekrar etme riski var.
- Grup dersi akisi ana sayfa ve ayri ekran olarak iki yerde; join/leave state'inin tek kaynaktan dogru normalize edilmesi kritik.
- Rezervasyon iptali ve saat degisikligi gibi aksiyonlarda kullaniciya "sonuc ne oldu?" bilgisinin her yerde yeterince net oldugundan emin olunmali.
- Bos veri durumlari var ama bazilari kullaniciyi yeni aksiyona yeterince yonlendirmiyor.

### 3.5 Net Hatalar ve Riskler

P0:

- Grup dersi katilim is kurali backend testlerinde kirmizi. Member mobilde bu su riskleri dogurur:
  - Bekleyen talebi olan uye tekrar "katil" deneyebilir.
  - Kontenjan dolu durumda dogru mesaj yerine "ders basladi" gibi yanlis mesaj gorulebilir.
  - Ana sayfa grup dersi karti ile detay grup dersi ekrani farkli state gosterebilir.

P1:

- `home.tsx` icinde `latest_meaşurement` ve `meaşured_at` fallback'leri var. Bu, veri sozlesmesindeki yazim hatalarini sessizce kabul ediyor.
- `mobile-api.ts` icinde Turkce karakterli alias'lar var: `getPublıcSalonsApi`, `getAdminMemberMeaşurementsApi`. Bunlar ileride import/encoding sorunlari ve bakim zorlugu yaratir.
- `plan`, `package`, `calendar`, `home` birbiriyle cok bagli. Cache invalidation merkezi degilse farkli ekranlarda eski veri gorunebilir.

P2:

- Member icin motivasyon/ilerleme dili gelistirilebilir. Olcum trendi var ama hedefe bagli "bu hafta ne yapmaliyim?" onerisi zayif.
- Referral ekrani var; kampanya/odul dili daha net satis/viral donguye baglanabilir.

### 3.6 Member Icin Onerilen Aksiyonlar

1. Grup dersi join/leave state'ini once duzelt, sonra member E2E smoke'a ekle.
2. Typo fallback'leri kaldirmadan once backend contract test yaz.
3. `package`, `plan`, `progress` ekranlarini bilgi mimarisi olarak sadeleştir:
   - `package`: satin alma/kredi/odeme.
   - `plan`: uygunluk/hedef.
   - `progress`: sonuc ve gecmis.
4. Rezervasyon iptali ve saat degisikligi icin net sonuc toast/alert standardi koy.
5. Bos veri durumlarina dogru CTA ekle: "Takvime git", "Paket sec", "Ilk olcumu ekle".

## 4. Trainer Rolu

### 4.1 Ekran Envanteri

Ana tablar:

- `calendar`: egitmen takvimi.
- `clients`: danisanlar.
- `home`: ana sayfa.
- `earnings`: kazanc.
- `profile`: profil.

Detay/ikincil ekranlar:

- `today`: bugun.
- `packages`: paketlerim/atanmis paketler.
- `qr`: egitmen QR.
- `bookings`: ders listesi.
- `checkin`: QR/manual check-in.
- `members`: danisan listesi alternatifi.
- `members/[id]`: danisan detay.
- `risk`: riskli danisanlar.
- `notes`: notlar.
- `note-edit`: not ekleme/duzenleme.
- `group-classes`: grup dersi olusturma/duzenleme/silme.

### 4.2 Ana Deneyim

Trainer ana sayfa dogru isleri one cikariyor:

- Bugunku ders sayisi.
- Aylik gelir.
- Riskli uye sayisi.
- Takvim, yoklama/QR, egitmen QR, paketler, kazanc, danisanlar, profil, grup dersleri hizli aksiyonlari.

Egitmen icin gunluk kullanim ihtiyaci net: ders akisini gor, yoklama al, danisan detayina gir, grup dersi ac, kazanci takip et.

### 4.3 Canli Veri Durumu

Demo trainer ile yapilan kontrolde:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `TRAINER_HOME`
- Mobil aksiyonlar: `CHECKIN`, `VIEW_SCHEDULE`, `VIEW_EARNINGS`
- Scan capability: `TRAINER_CHECKIN`
- Calisan endpointler:
  - `/trainer/today`: 200.
  - `/trainer/bookings`: 200.
  - `/trainer/group-classes`: 200.
  - `/trainer/members`: 200.
  - `/trainer/qr`: 200.
- Kirik endpoint:
  - `/trainer/risk`: 404. Backend route'u `/trainer/risk/members`.

### 4.4 Kullanilabilirlik Degerlendirmesi

Iyi noktalar:

- Trainer home sade ve aksiyon odakli.
- Check-in akisi merkezi yerde; bu salon ici kullanim icin kritik.
- Danisan detay ekraninda profil, katilim, olcum, not ve aksiyonlar dusunulmus.
- Grup dersi ekrani guclu: paket, tarih, saat, tekrar, hedef kitle ve davetli uyeler gibi gercek operasyon ihtiyaclarini kapsiyor.
- Calendar ekrani sadece liste degil; ders olusturma, iptal, saat degisikligi ve danisan detayina baglaniyor.

Zayif noktalar:

- Trainer icin `clients` ve `members` ayrimi kafa karistirabilir. Ikisi ayni amaca hizmet ediyorsa tek kavram secilmeli.
- `today`, `home`, `calendar`, `bookings` ayni ders verisini farkli acilardan gosteriyor. Bu iyi olabilir ama veri tutarliligi riski yuksek.
- Grup dersi formu cok kapsamli; mobilde uzun form yorgunlugu yaratabilir.
- Kazanc ekrani guven gerektirir; finansal hesaplamalarda aciklama ve kaynak detaylari net olmali.

### 4.5 Net Hatalar ve Riskler

P0:

- Trainer risk ekrani canli olarak kirik. `apps/mobile/src/lib/mobile-api.ts` icinde `getTrainerRiskApi()` `/trainer/risk` endpoint'ine gidiyor. Backend `apps/api/routes/trainer/risk.route.ts` icinde `/members` ve `/members/:memberId` sunuyor. Bu ekran kullaniciya ya bos ya hata durumlu gorunecek.

P1:

- Trainer risk sayisi home'da `/trainer/today` icinden geliyor, risk ekraninda baska endpoint bekleniyor. Bu iki kaynak senkron degilse sayi ve liste uyusmaz.
- Grup dersi create/update/delete ekranlari kritik is kurallari tasiyor. Backend grup dersi/member join tarafinda test kirik oldugu icin egitmen tarafinda da doluluk/onay/katilim karmasasi olabilir.
- `calendar.tsx` cok fazla sorumluluk tasiyor: booking, availability, today, group classes, members, member detail, notes, attendance, measurements, create/cancel/reschedule. Uzun vadede bakim maliyeti yuksek.

P2:

- Egitmen notlari degerli bir ozellik; not gecmisi, gizlilik, kim gorebilir, admin gorebilir mi gibi urun politikalari netlestirilmeli.
- Check-in tekrar okutma, gec kalma, yanlis uye QR, offline durumlari daha gorunur test edilmeli.

### 4.6 Trainer Icin Onerilen Aksiyonlar

1. `getTrainerRiskApi()` endpoint'ini `/trainer/risk/members` yap.
2. Trainer risk ekranina smoke test ekle.
3. `clients` ve `members` kavramlarini birlestir veya net ayir:
   - `clients`: ana liste.
   - `members`: legacy route ise kaldir veya gizli tut.
4. Calendar ekranini bol:
   - veri hazirlama hook'u,
   - booking aksiyonlari,
   - member detail bottom sheet/modal,
   - reschedule flow.
5. Grup dersi formunda adimlama dusun: temel bilgi -> zaman -> hedef kitle -> onay.

## 5. Admin Mobil Rolu

### 5.1 Ekran Envanteri

Ana tablar:

- `calendar`: salon takvimi.
- `approvals`: onaylar.
- `dashboard`: ana sayfa.
- `members`: uyeler/egitmenler.
- `profile`: profil.

Detay/ikincil ekranlar:

- `approval/[id]`: onay detay.
- `campaign-create`: kampanya olusturma.
- `campaigns`: kampanyalar.
- `campaigns/new`: yeni kampanya.
- `clinic-qr`: salon QR.
- `dashboard/revenue-detail`: gelir detay.
- `dashboard/risk-preview`: risk onizleme.
- `entry-scan`: giris tarama.
- `members/[id]`: uye/egitmen detay.
- `notifications`: bildirimler.
- `packages`: paketler.
- `pricing`: fiyat ayarlari.
- `risk-members`: riskli uyeler.
- `salon`: salon yonetim merkezi.
- `salon/setup`: salon kurulum.
- `salon-profile`: public profil/vitrin.
- `subscription`: abonelik.
- `working-hours`: calisma saatleri.

### 5.2 Ana Deneyim

Admin dashboard cok islevli:

- Aktif uye/egitmen metrikleri.
- Bekleyen onay, bugunku ders, riskli uye.
- Gunluk operasyon: onaylar, giris tarama, takvim, uyeler.
- Yonetim araclari: risk havuzu, paketler, kampanyalar, dijital vitrin, gelir detayi, salon ayarlari, salon QR.

Admin mobil uygulama "sahada hizli operasyon" icin guclu. Salon sahibi telefondan onay, QR, takvim, uye ve risk islerini gorebilir.

### 5.3 Canli Veri Durumu

Demo admin ile yapilan kontrolde:

- Login basarili.
- `onboarding_state`: `ACTIVE_SALON`
- `recommended_entry_surface`: `ADMIN_HOME`
- Mobil aksiyonlar: `VIEW_DASHBOARD`, `APPROVE_REQUESTS`, `SEND_NOTIFICATIONS`
- Scan capability: `SALON_ENTRY`
- Calisan endpointler:
  - `/admin/dashboard`: 200; aktif egitmen 1, aktif uye 5, riskli uye 4, lead 2, paket 6.
  - `/admin/mobile-approvals`: 200; demo veride 0.
  - `/admin/bookings`: 200.
  - `/admin/members`: 200.
  - `/admin/packages`: 200.
  - `/admin/clinic/qr`: 200.
  - `/admin/clinic/subscription`: 200.

### 5.4 Kullanilabilirlik Degerlendirmesi

Iyi noktalar:

- Admin icin ana isler mobilde erisilebilir.
- Onaylar ve giris tarama gibi hizli karar isteyen aksiyonlar tab seviyesinde veya dashboard hizli aksiyonunda.
- Uyeler ekraninda role/status filtreleme ve detay ekrani var.
- Uye/egitmen detay ekrani oldukca zengin: katilim, olcum, risk, egitmen yetkinlikleri, kazanc, paket atamalari.
- Salon QR ekrani urun-buyume baglantisi icin iyi.
- Salon profil, calisma saatleri, fiyat ve paket ayarlari mobilde de dusunulmus.

Zayif noktalar:

- Admin mobil cok genis. Bir telefonda dashboard, finans, paket, fiyat, kampanya, dijital vitrin, abonelik, salon setup, QR, risk, bildirim gibi her seyi tasimak zihinsel yuk yaratir.
- Admin dashboard'da cok sayida aksiyon var; en kritik 3-4 operasyon ile seyrek ayarlar ayrimi daha keskin olmali.
- `campaign-create` ve `campaigns/new` iki farkli kampanya olusturma rotasi gibi duruyor; duplicasyon riski var.
- `salon`, `salon-profile`, `pricing`, `working-hours`, `packages`, `subscription` birbiriyle baglantili ayarlar. Kullanici "hangi ayar nerede?" diye zorlanabilir.

### 5.5 Net Hatalar ve Riskler

P0:

- Admin QR payload'i Detour base olarak eski `clinerva.godetour.link` izini tasiyor. Mobil admin QR ekraninda kaydedilecek/paylasilacak QR production'da marka guveni acisindan riskli.

P1:

- `campaign-create` ve `campaigns/new` ayrimi net degil; iki ekran ayni isi yapiyorsa biri kaldirilmali.
- Admin mobilde subscription/public publish gibi finansal ve yayin kararlari var. Yanlis tiklama veya eksik aciklama urun destegi yukunu artirir.
- Uye/egitmen detay ekrani cok veri cekiyor; zayif baglantida gec acilabilir.
- Riskli uye sayisi dashboard'da gorunuyor ama "hangi aksiyon alinmali?" net olmayabilir.

P2:

- Mobil admin profil/ayarlar deneyimi "sahada hizli is" ve "masa basi derin yonetim" diye ayrilmali.
- Gelir detaylari mobilde ozetlenmeli; tam muhasebe admin-web'e birakilabilir.

### 5.6 Admin Icin Onerilen Aksiyonlar

1. QR/Detour marka ve environment config'ini duzelt; `clinerva` izini kaldir.
2. Admin dashboard aksiyonlarini onceliklendir:
   - P0: onaylar, bugunku takvim, giris tarama, uyeler.
   - P1: risk, paketler, QR.
   - P2: salon ayarlari, pricing, subscription, vitrin.
3. `campaign-create` ve `campaigns/new` rotalarini tek akisa indir.
4. Salon ayarlarini tek "Salon" merkezinde grupla:
   - Profil/vitrin.
   - Calisma saatleri.
   - Paket/fiyat.
   - QR.
   - Abonelik.
5. Uye/egitmen detay ekraninda lazy loading veya sekme bazli veri cekme yap.

## 6. Mobil Ortak Sorunlar

### 6.1 Veri Sozlesmesi

Mobil API helper dosyasi cok buyuk ve bazi eski/yanlis alanlari tolere ediyor. Bu kisa vadede kirmayi onler ama uzun vadede backend-mobile kontratini belirsizlestirir.

Ornekler:

- `reasom`
- `primary_reasom`
- `risk_reasom`
- `latest_meaşurement`
- `meaşured_at`
- `getPublıcSalonsApi`
- `getMemberMeaşurementsApi`

Oneri:

- Bu alias'lari "deprecated compatibility" olarak isaretle.
- Yeni kodda kullanimi yasakla.
- Contract test ile dogru alanlari zorunlu kil.

### 6.2 Cache ve Refetch

Bazi mutation'lar cok genis query listelerini invalidate ediyor. Bu, veri tutarliligi icin iyi niyetli ama mobil performansta sorun yaratabilir.

Oneri:

- Rol bazli cache key standardi yaz.
- Her mutation icin minimum gerekli invalidation listesi belirle.
- Kritik ekranlarda optimistic update sadece guvenli yerlerde kullan.

### 6.3 Bos/Hata/Yukleniyor Durumlari

EmptyState ve EmptyPanel var, bu iyi. Fakat hata durumlarinda bazi ekranlar yalniz bos gorunebilir.

Oneri:

- Her ana ekran icin uc durum standardi:
  - Loading skeleton veya net yukleniyor durumu.
  - Error + tekrar dene.
  - Empty + dogru CTA.

### 6.4 E2E Smoke

Maestro dosyalari oldukca fazla. Yine de kritik urun kapisi olarak her rol icin minimal smoke listesi netlestirilmeli.

Member smoke:

- Login -> home.
- Paketim -> public paket -> satin alma niyeti.
- Takvim -> booking detay.
- Grup dersleri -> katil/bekleyen state.
- Olcumler -> olcum ekle.
- Profil -> QR.

Trainer smoke:

- Login -> home.
- Takvim -> ders detay.
- Check-in -> manuel kod/QR ekran acilir.
- Danisanlar -> detay -> not.
- Grup dersi -> olustur/duzenle/sil talebi.
- Risk -> liste acilir.

Admin smoke:

- Login -> dashboard.
- Onaylar -> detay.
- Uyeler -> uye/egitmen detay.
- Takvim -> ders listesi.
- Paketler -> paket listesi.
- Salon QR -> QR preview.
- Risk havuzu -> liste.

## 7. Mobil Production Hazirlik Skoru

Member: 7/10

- Cekirdek deneyim var ve veri geliyor.
- Grup dersi/hata state ve typo contract riskleri giderilirse pilot icin guclenir.

Trainer: 6/10

- Ana isler guclu: takvim, check-in, danisan, grup dersi.
- Risk ekrani kirik oldugu icin production skoru dusuyor.

Admin Mobil: 6.5/10

- Kapsam genis ve guclu.
- Fakat cok fazla derin ayar mobilde; sadeleştirme ve QR/brand config duzeltmesi sart.

Genel Mobil: 6.5/10

- Urun potansiyeli yuksek.
- Kritik sozlesme hatalari ve ekran karmasasi giderilirse 8/10 seviyesine hizli cikabilir.

## 8. En Onemli 10 Mobil Aksiyon

1. Trainer risk endpoint kirigini duzelt.
2. Member grup dersi join/leave backend testlerini ve mobil state'lerini duzelt.
3. QR/Detour eski marka/env riskini temizle.
4. Mobile API helper icindeki typo alias'lari deprecated yap ve yeni kullanimlari kaldir.
5. Member `package-plan-progress` bilgi mimarisini netlestir.
6. Trainer `calendar.tsx` sorumluluklarini bol.
7. Admin mobil dashboard'u sadeleştir; derin ayarlari tek salon merkezinde grupla.
8. Her rol icin minimal Maestro smoke setini CI kapisi yap.
9. Hata/bos/yukleniyor state standardini tum ana ekranlara uygula.
10. Query invalidation politikasini merkezi ve minimum hale getir.

## 9. Sonuc

Mobil uygulama "yok" degil; aslinda urunun en yogun ve en ileri kismi mobilde. Onceki raporda bu derinlik yeterince gorunmemis. Bu detayli mobil rapora gore uygulama uc rolde de gercek is akislari tasiyor:

- Member: paket, takvim, grup dersi, olcum, QR, referral.
- Trainer: takvim, check-in, danisan, not, grup dersi, kazanc.
- Admin: dashboard, onay, uyeler, risk, paket, kampanya, QR, salon ayarlari.

Ama pilot/production oncesi mobilde once sozlesme kiriklari ve kritik ekran hatalari kapatilmali. Ozellikle trainer risk, member grup dersi ve admin QR/Detour konulari ilk sirada ele alinmali.
