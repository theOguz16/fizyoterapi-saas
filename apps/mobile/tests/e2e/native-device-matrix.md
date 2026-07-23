# Native ve dış sistem cihaz test matrisi

Bu matris, Maestro'nun uygulama içi ekran ve akış testinden ayrı tutulur.
Bir simülatörde görünen sistem penceresi, fiziksel donanım veya gerçek dış
sistem işleminin kanıtı sayılmaz.

## Sonuç sınıfları

- `SIMULATOR`: iOS Simulator veya Android Emulator'da yapılabilir ve kanıtı
  alınabilir.
- `SIMULATOR_PARTIAL`: yalnızca uygulamanın ilgili çağrıyı yaptığı, izin
  durumu ya da sistem ekranının açıldığı doğrulanabilir; gerçek dış sistem
  sonucu kanıtlanamaz.
- `DEVICE_REQUIRED`: fiziksel cihaz ve belirtilen dış hesap/ortam zorunludur.

| Alan | Simülatör kanıtı | Fiziksel cihaz kanıtı | Sonuç sınıfı |
| --- | --- | --- | --- |
| Kamera ile QR okutma | Kamera ekranı, izin ve manuel giriş fallback'i | Basılı/başka telefondaki gerçek QR'ın taranması ve API check-in sonucu | `DEVICE_REQUIRED` |
| QR görselini Fotoğraflar'a kaydetme | İzin reddi/izin verilmesi ve uygulama geri bildirimi | Fotoğraflar/Galeri uygulamasında `fizyoflow-salon-qr-*.png` dosyasının görünmesi | `SIMULATOR_PARTIAL` |
| Native paylaşım ekranı | Share sheet'in açılması | Mesajlar, WhatsApp vb. gerçek hedefe gönderim ve açılan bağlantının doğruluğu | `SIMULATOR_PARTIAL` |
| Bildirim izni | İlk izin penceresi, reddedilme ve Ayarlar'a yönlendirme | APNs/FCM token kaydı ve foreground/background/terminated gerçek bildirim teslimi | `DEVICE_REQUIRED` |
| Biyometrik giriş | iOS Simulator'da Face ID/Touch ID enroll-match/fail simülasyonu | Gerçek Face ID/Touch ID/cihaz şifresi fallback'i | `SIMULATOR_PARTIAL` |
| App Store / Google Play sandbox satın alma | StoreKit/Xcode veya test ödeme ekranının açılması; gerçek mağaza değildir | TestFlight sandbox ve Google Play license tester satın alma, RevenueCat entitlement ve backend senkronizasyonu | `DEVICE_REQUIRED` |
| Satın alma geri yükleme | SDK çağrısı ve hata/boş durum | Aynı sandbox hesabının önceki işleminin entitlement olarak geri gelmesi ve backend senkronizasyonu | `DEVICE_REQUIRED` |
| Harici yasal bağlantılar | `Linking.openURL` ile tarayıcı/uygulama geçişi | iOS Safari ve Android varsayılan tarayıcıda HTTPS sayfalarının gerçek açılışı | `SIMULATOR_PARTIAL` |

## Simülatör doğrulama paketi

Bu paket, dış sistem sonucunu değil uygulamanın doğru native çağrıyı başlattığını
doğrular. Her satırda ekran görüntüsü ve Maestro logu saklanır.

1. iOS Simulator veya Android Emulator'da debug build'i açın.
2. Yönetici hesabıyla `/(admin)/clinic-qr` ekranına geçin.
3. `admin-clinic-qr-share-button` ile native paylaşım ekranının açıldığını,
   `admin-clinic-qr-save-button` ile fotoğraf izni ve başarı/hata geri
   bildiriminin çalıştığını doğrulayın.
4. Yönetici `/(admin)/entry-scan` ekranında kamera izni durumlarını doğrulayın.
   Simülatörde gerçek kamera taraması yerine manuel kod akışını ayrıca çalıştırın.
5. `/(shared)/notification-settings` ekranında ilk izin, reddedilmiş izin ve
   `Cihaz ayarlarını aç` davranışını doğrulayın.
6. Enroll edilmiş iOS Simulator'da hesabın güvenlik kartından biyometrik girişi
   açın; çıkış sonrası `login-biometric-button` ile başarılı ve başarısız
   eşleşmeyi simüle edin.
7. `/(admin)/subscription` ekranında
   `admin-subscription-purchase`, `admin-subscription-restore` ve
   `admin-subscription-legal-links` giriş noktalarının görünür olduğunu
   doğrulayın. Bu adım mağaza sandbox işlemi olarak raporlanmaz.
8. Kayıt/onay ekranındaki `Kullanım Şartları` ve `Gizlilik Politikası`, ayrıca
   abonelik ekranındaki EULA ve gizlilik bağlantılarının bir tarayıcıya
   devredildiğini doğrulayın.

Mevcut otomatik ön kontroller:

- `tests/unit/native-permissions.test.ts`: kamera, daraltılmış fotoğraf izni,
  Android mikrofon izninin kaldırılması ve QR export çağrısını doğrular.
- `tests/unit/revenuecat.test.ts`: RevenueCat teklif, satın alma iptali/hatası,
  geri yükleme ve platform anahtarı hata sözleşmelerini doğrular.
- `tests/e2e/maestro/admin-clinic-qr-smoke.yaml`: QR ekranı ve uygulama içi
  paylaşım/kaydetme giriş noktalarını doğrular; native sonuç kanıtı değildir.

## Fiziksel cihaz release paketi

Her platform için dağıtılmış aynı build numarası, model/OS sürümü, test zamanı
ve kanıt dosyaları kaydedilmelidir. Test hesabı ve tokenlar kanıt dosyasına
yazılmaz; yalnızca maskeli kimlik ve transaction ID yazılır.

### iOS: fiziksel iPhone + TestFlight

Ön koşullar:

- TestFlight build, geliştirici modu açık ve test Apple ID'si sandbox satın
  alma için hazır.
- RevenueCat iOS public SDK key, App Store ürünleri ve entitlement eşlemesi
  build ortamında tanımlı.
- Kamera ile okunacak geçerli ve geçersiz iki ayrı QR görseli hazır.

Kanıt adımları:

1. Kamera izni verin; geçerli QR'ı okutun ve oluşan check-in/API sonucunu
   kaydedin. Geçersiz QR'ın kullanıcıya anlaşılır hata verdiğini doğrulayın.
2. QR'ı Fotoğraflar'a kaydedin; Fotoğraflar uygulamasında dosyayı açın.
3. Paylaşım ekranından gerçek bir hedefe paylaşın; bağlantının doğru salonu
   açtığını doğrulayın.
4. Bildirim iznini önce reddedin, sonra Ayarlar'dan açın. Mevcut
   `pnpm test:e2e:push:permission-denied` ve `pnpm test:e2e:push:device`
   matrisi ile üç rolün foreground/background/terminated teslim kanıtını alın.
5. Face ID/Touch ID ile giriş, ret ve cihaz şifresi fallback'ini doğrulayın.
6. Aylık veya yıllık ürünü Apple sandbox ile satın alın. RevenueCat dashboard
   entitlement'i, App Store sandbox transaction ID'si ve backend abonelik
   yenilemesini birlikte kaydedin.
7. Uygulamayı silip yeniden kurun veya yeni oturumda `Satın almaları geri
   yükle` seçeneğini kullanın; aynı entitlement'in ve backend planının geri
   geldiğini doğrulayın.
8. Gizlilik, Kullanım Koşulları/EULA bağlantılarını Safari'de açıp HTTP 200 ve
   doğru alan adını kaydedin.

### Android: fiziksel telefon + Google Play internal/closed testing

Ön koşullar:

- Google Play internal veya closed test build, license tester Google hesabı ve
  Play Store yüklü fiziksel Android cihaz.
- RevenueCat Android public SDK key, Google Play ürünleri ve entitlement
  eşlemesi build ortamında tanımlı.

Kanıt adımları iOS ile aynıdır; ek olarak Android'de kamera/fotoğraf izinleri,
bildirim izni (Android 13+), paylaşım hedefi ve Play purchase/restore sonucu
ayrı kaydedilir. `EAS` ile alınmış APK tek başına Google Play sandbox satın
alma kanıtı değildir; işlem Play test kanalından yüklenen build ile yapılır.

## Zorunlu release kanıtı

Her `DEVICE_REQUIRED` satırı için aşağıdaki alanlar tamamlanmadan `passed`
yazılamaz:

```text
platform: ios | android
build: <version(buildNumber)>
device: <model / OS>
testAccount: <maskeli hesap kimliği>
timestamp: <ISO-8601>
result: passed | failed
artifact: <ekran kaydı, screenshot veya Maestro log yolu>
externalProof: <transaction ID, entitlement, API sonucu veya tarayıcı URL'si>
```

Başarısız ya da eksik fiziksel cihaz testi, simülatör sonucu ile telafi
edilemez. Bu matris release kararında açık istisna olarak raporlanmalıdır.
