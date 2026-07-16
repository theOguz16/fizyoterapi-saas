# Mobile E2E Flows

Bu klasörde mobil ürün için iki katman bulunur:

1. `maestro/`
Kritik akışların hızlı smoke doğrulaması için YAML akışları.

2. `Detox`
Native seviye cihaz otomasyonu istenirse ikinci aşamada genişletilecek.

Mevcut Maestro akışları:
- `login-role-routing.yaml`
- `member-onboarding.yaml`
- `member-bookings-smoke.yaml`
- `trainer-today-smoke.yaml`
- `admin-owner-setup.yaml`
- `admin-approvals-smoke.yaml`

Çalıştırma:
```bash
maestro test tests/e2e/maestro
```

Release kritik dosyalarının yalnız syntax kontrolü için:

```sh
pnpm release:e2e:mobile:syntax
```

Bu komut cihaz sonucu üretmez. Release için `run-critical-e2e.sh` içindeki dokuz akış aynı production EAS build ID'siyle hem fiziksel iOS hem fiziksel Android cihazda çalıştırılır. Her platformun Maestro log/video kaydı `RELEASE_EVIDENCE` manifestindeki `maestro.ios` veya `maestro.android` alanına eklenir.

Deep link ve fiziksel QR farklı kanıtlardır. Deep link URL/scheme açılışını; QR ise cihaz kamerası ile gerçek kod taramasını ve hedef salon ekranını kaydetmelidir. RevenueCat kanıtı da her platform için store sandbox transaction ID, entitlement sonucu ve backend senkronizasyon logunu ayrı tutar. Tam alan matrisi `docs/release-gate.md` içindedir.

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
