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

Not:
- iOS tarafında oturum sızıntısını önlemek için flow'lar `launchApp.clearState: true` ve `clearKeychain: true` ile başlar.
