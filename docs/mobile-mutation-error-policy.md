# Mobil form hata ve sınır durum politikası

Bu politika `apps/mobile/app` altındaki tüm React Query mutation yüzeyleri için
geçerlidir. Şu an 25 ekran dosyasında 39 mutation bulunur. Yeni bir mutation,
bu merkezi davranışları atlayacak ayrı bir `fetch` istemcisi kullanamaz.

## Ortak garanti

1. Tüm `mobile-api` HTTP çağrıları 15 saniye sonunda `REQUEST_TIMEOUT` ile
   biter. Bu nedenle HTTP butonu sonsuza kadar loading durumunda kalmaz.
2. Bağlantı hatası çevrimdışı banner'ını açar; timeout ise bağlantı kesildi
   varsayılmaz ve kullanıcıya ayrı zaman aşımı mesajı verilir.
3. 400, 401, 403, 404, 408/504, 409, 422, 429 ve 5xx cevapları teknik hata
   metni yerine kullanıcıya uygun Türkçe mesajla gösterilir.
4. Mutation kendi `onError` geri bildirimini tanımlamıyorsa `MutationCache`
   otomatik olarak görünür bir hata alert'i verir. Kendi `onError`'ı olan ekran
   aynı hatayı iki kez göstermemelidir.
5. `ActionButton`, `loading` durumundayken devre dışı kalır. Özel hedef seçim
   chip'leri de mutation pending iken devre dışıdır.
6. Sunucu işlemi başarılı olup oturum yenilemesi başarısızsa kullanıcıya
   `İşlem tamamlandı` mesajı gösterilir; başarı sonrası yönlendirme devam eder.

## Form grupları

| Grup | Ekranlar | İstemci eksik veri kontrolü | Sunucu sınır/hata kontrolü |
| --- | --- | --- |
| Kimlik ve onboarding | login, register, member-register, invite-accept, salon QR | zorunlu alan, şifre eşleşmesi, yasal onay | yetkisiz, mevcut üyelik/başvuru, geçersiz QR |
| Klinik yönetimi | salon/setup, salon-profile, working-hours, packages, pricing | zorunlu klinik/paket/saat alanları | mevcut klinik, 409, 422, yetki |
| Yönetici operasyonu | approvals, campaigns, notifications, entry-scan, subscription | seçim/kod alanları | 403, 404, çifte işlem, 5xx, mağaza hatası |
| Eğitmen operasyonu | calendar, checkin, notes, note-edit, group-classes, bulk-notification | zorunlu tarih/saat/not/alıcı | yetki, çakışma, kapasite, 422 |
| Danışan işlemleri | bookings, group-classes, home, measurements, plan, referrals, leave-salon | gerekli seçim ve değerler | iptal penceresi, aktif paket, çift katılım, 409 |
| Başvuru ve ödeme öncesi | booking-summary | paket/eğitmen/slot özeti | mevcut başvuru, uygunluk, yetki, yenileme hatası |

## Doğrulama matrisi

Her form grubu için aşağıdaki sonuçlar en az bir gerçek mutation ile doğrulanır:

- Eksik veya geçersiz veri: buton engellenir ya da alan mesajı/422 kullanıcıya gösterilir.
- Yetkisiz veya bulunamayan kayıt: 401/403/404 kullanıcıya teknik ayrıntı olmadan gösterilir.
- Mevcut kayıt/çift tıklama: 409 mesajı görünür, ikinci işlem loading süresince gönderilmez.
- Yavaş API/zaman aşımı: 15 saniye sonunda loading biter ve tekrar deneme mesajı görünür.
- Çevrimdışı: banner görünür, istek hata mesajı verir; bağlantı dönünce aktif sorgular yenilenir.
- 5xx: geçici sunucu sorunu mesajı görünür; form verisi kullanıcı ekranında kalır.
- Başarılı işlem + `refreshMe` hatası: başarı bilgisi görünür; kullanıcı aynı işlemi tekrar göndermeye zorlanmaz.

Bu politika HTTP dışı native/store işlemlerini kapsamaz; onların gerçek cihaz ve
store sandbox kanıtı `apps/mobile/tests/e2e/native-device-matrix.md` içindedir.
