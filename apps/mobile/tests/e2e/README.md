# Mobile E2E Flows

Bu klasörde mobil ürün için iki katman bulunur:

1. `maestro/`
Kritik akışların hızlı smoke doğrulaması için YAML akışları.

2. `Detox`
Native seviye cihaz otomasyonu istenirse ikinci aşamada genişletilecek.

Kamera, galeri, native paylaşım, biyometri, bildirim ve mağaza sandbox
işlemlerinin simülatör/fiziksel cihaz ayrımı ile kanıt adımları
`native-device-matrix.md` dosyasındadır. Bu işlemler Maestro smoke sonucuna
dahil edilmez.

Release doğrulaması `release-role-matrix.txt` dosyasındaki rol ve yetenek
envanterini kullanır. Bu matris geniş bir smoke/deep-link kapsamıdır; bütün
dosyalarının gerçek iş sonucu ürettiği varsayılmaz. Dosya bazındaki gerçek
kapsam sınıflandırması `docs/maestro-test-inventory.md` içindedir.

Kapsanan ana alanlar:

- Admin: login/yönlendirme, klinik sahibi girişi, onay merkezi, takvim,
  eğitmen profili, grup dersi onayları, paket oluşturma/bağlama, abonelik ve
  gelir raporu.
- Trainer: login/yönlendirme, bugün ekranı, günlük operasyon, takvim ve
  talepler, manuel check-in, grup dersi oluşturma ve silme kontrolü, atanmış dersler,
  talep merkezi ve toplu bildirim ekranı.
- Member: login/yönlendirme, onboarding, rezervasyonlar, takvim, grup dersleri,
  ölçüm oluşturma, paket yenileme, intake/öneri, çoklu paket randevusu, klinik
  bağlantıları/deep linkler, profil koruma ve ilerleme özeti.
- Paylaşılan: rol routing, geri navigasyon, release edge-case sözleşmesi ve duo
  paketin üç roldeki görünürlüğü.

Çalıştırma:
```bash
maestro test tests/e2e/maestro
```

Release matrisini önce yazılı olarak incelemek veya rol bazında çalıştırmak için:

```sh
pnpm --filter @fitnes-saas/mobile test:e2e:matrix:list
pnpm --filter @fitnes-saas/mobile test:e2e:matrix -- --role admin
pnpm --filter @fitnes-saas/mobile test:e2e:matrix -- --role trainer
pnpm --filter @fitnes-saas/mobile test:e2e:matrix -- --role member
```

Runner her akıştan önce rol, yetenek ve dosya adını; sonunda seçilen, geçen ve
başarısız sayısını basar. Bir akış hata verse bile kalan matris çalıştırılır ve
komut sonuçta hata koduyla kapanır.

Release kritik dosyalarının yalnız syntax kontrolü için:

```sh
pnpm release:e2e:mobile:syntax
```

Bu komut cihaz sonucu üretmez. Eski `test:e2e:critical` adı geriye dönük
uyumluluk için korunur ve artık rol matrisinin tamamını çalıştırır. Release için
matristeki akışlar aynı production EAS build ID'siyle hem fiziksel iOS hem
fiziksel Android cihazda çalıştırılır. Her platformun Maestro log/video kaydı
`RELEASE_EVIDENCE` manifestindeki `maestro.ios` veya `maestro.android` alanına
eklenir.

## Bilerek release simülatör matrisine alınmayanlar

- `push/`: TestFlight/production-like build, gerçek cihaz, APNs/Expo token ve
  harici bildirim gönderimi gerektirir; aşağıdaki ayrı cihaz matrisi kullanılır.
- `marketing-*.yaml` ve `admin-subscription-screenshot.yaml`: ürün davranışı
  doğrulamak yerine ekran görüntüsü üretir.
- `debug-intake-packages.yaml`: tanı amaçlıdır, assertion tabanlı release gate
  değildir.
- Gerçek kamera QR kanıtları: simülatör deep link testinden farklıdır ve release
  evidence kapsamında fiziksel cihazda tutulur.
- Store sandbox satın alma/RevenueCat entitlement: gerçek store hesabı ve
  transaction kanıtı gerektirdiğinden deterministik yerel simülatör matrisinin
  parçası değildir.
- Davetle yeni hesap açma ve zincirleme çapraz-rol grup dersi fixture akışları:
  sabit seed üzerinde tekrar çalıştırıldığında veri biriktirir veya önceki flow
  durumuna bağlıdır. Bunların bağımsız backend fixture/reset sözleşmesiyle ayrıca
  izole edilmesi gerekir.

Deep link ve fiziksel QR farklı kanıtlardır. Deep link URL/scheme açılışını; QR ise cihaz kamerası ile gerçek kod taramasını ve hedef salon ekranını kaydetmelidir. RevenueCat kanıtı da her platform için store sandbox transaction ID, entitlement sonucu ve backend senkronizasyon logunu ayrı tutar. Tam alan matrisi `docs/release-gate.md` içindedir.

## İzole fonksiyonel E2E ortamı

Gerçek iş sonucu oluşturan akışlar, production'dan ayrı PostgreSQL veritabanı
ve production Dockerfile ile derlenmiş API üzerinde çalıştırılır. Her akıştan
önce veritabanı tamamen temizlenir ve demo fixture'ları yeniden oluşturulur;
bu nedenle yönetici, eğitmen ve danışan test verileri akışlar arasında taşmaz.

Önce Metro'yu E2E API adresiyle başlatın:

```sh
EXPO_PUBLIC_E2E_MODE=1 \
EXPO_PUBLIC_API_BASE=http://127.0.0.1:4949/api \
pnpm dev
```

Ardından ayrı bir terminalde izole fonksiyonel matrisi çalıştırın:

```sh
pnpm test:e2e:functional:isolated
```

Ortam yönetimi için:

```sh
sh ../../scripts/mobile-e2e-env.sh up
sh ../../scripts/mobile-e2e-env.sh reset
sh ../../scripts/mobile-e2e-env.sh status
sh ../../scripts/mobile-e2e-env.sh down
```

Bu komutlar yalnızca `fizyoflow-e2e` Docker projesini, `fizyoflow_e2e`
veritabanını, `55433` PostgreSQL portunu ve `4949` API portunu kullanır.
Production compose, production volume ve production veritabanına erişmez.

Not:
- iOS tarafında oturum sızıntısını önlemek için flow'lar `launchApp.clearState: true` ve `clearKeychain: true` ile başlar.

## Gerçek cihaz push release matrisi

`maestro/push/` akışları simülatör için değildir. Bağlı fiziksel iPhone ve TestFlight veya production-like build gerekir. iOS izin reddi yeniden prompt gösterilemediği için iki aşama uygulanır:

```sh
PUSH_E2E_DEVICE_ID=000081... \
PUSH_E2E_EVIDENCE_DIR=release-evidence/push-ios-45 \
PUSH_E2E_MEMBER_EMAIL=member@example.com \
PUSH_E2E_MEMBER_PASSWORD='...' \
pnpm --filter @fitnes-saas/mobile test:e2e:push:permission-denied
```

İlk aşamadan sonra iOS Ayarlar'dan FizyoFlow bildirim iznini açın. Ardından admin, trainer ve member için email, parola, Expo token ve backend token kayıt logu sağlayarak matrisi çalıştırın:

```sh
PUSH_E2E_DEVICE_ID=000081... \
PUSH_E2E_DEVICE_MODEL='iPhone 15' \
PUSH_E2E_OS_VERSION='iOS 18.6' \
PUSH_E2E_BUILD='ios-1.2.3(45)' \
PUSH_E2E_ENVIRONMENT=testflight \
PUSH_E2E_EVIDENCE_DIR=release-evidence/push-ios-45 \
PUSH_E2E_ADMIN_EMAIL=... PUSH_E2E_ADMIN_PASSWORD=... \
PUSH_E2E_ADMIN_EXPO_TOKEN='ExponentPushToken[...]' \
PUSH_E2E_ADMIN_REGISTRATION_LOG=/tmp/admin-token-registration.log \
PUSH_E2E_TRAINER_EMAIL=... PUSH_E2E_TRAINER_PASSWORD=... \
PUSH_E2E_TRAINER_EXPO_TOKEN='ExponentPushToken[...]' \
PUSH_E2E_TRAINER_REGISTRATION_LOG=/tmp/trainer-token-registration.log \
PUSH_E2E_MEMBER_EMAIL=... PUSH_E2E_MEMBER_PASSWORD=... \
PUSH_E2E_MEMBER_EXPO_TOKEN='ExponentPushToken[...]' \
PUSH_E2E_MEMBER_REGISTRATION_LOG=/tmp/member-token-registration.log \
pnpm --filter @fitnes-saas/mobile test:e2e:push:device
```

Runner her rol için foreground, background ve terminated durumlarını hazırlar, Expo'ya gerçek bildirim gönderir, bildirime dokunup hedef `testID` ekranını doğrular ve Expo/APNs receipt sonucunu kaydeder. Üretilen `push-release-evidence.json` en fazla 72 saat geçerlidir.

`PUSH_E2E_<ROLE>_REGISTRATION_LOG` dosyaları backend sorgusundan üretilmiş şu maskeli JSON sözleşmesini kullanır; tam token kanıt dosyasına yazılmaz:

```json
{
  "role": "ADMIN",
  "status": "registered",
  "isActive": true,
  "tokenSuffix": "...a1b2c3",
  "checkedAt": "2026-07-16T14:00:00.000Z"
}
```
