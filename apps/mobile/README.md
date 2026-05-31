# FizyoFlow Mobile

Expo managed mobil uygulama (role-based):
- Member: full akış
- Trainer/Admin: lite akış

## Çalıştırma

```bash
pnpm install
pnpm dev:mobile
```

Varsayılan API base:
- `EXPO_PUBLIC_API_BASE=http://localhost:4949/api`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...`

RevenueCat notu:
- `react-native-purchases` Expo Go icinde degil, development build icinde test edilir.
- `appUserID` olarak `tenant.id` kullanilir.
- Satin alma sonrasi backend webhook: `POST /api/billing/revenuecat/webhook`

## Auth modeli
- JWT Bearer + SecureStore
- `/api/auth/login` sonrası token saklanır
- Açılışta `/api/auth/me` ile rol doğrulanır

## Push cihaz kaydı
- `POST /api/mobile/devices/register`
- `DELETE /api/mobile/devices/:token`

## E2E

Maestro smoke akışları:

```bash
pnpm test:e2e:mobile
```

Detaylı çalışma talimatı için:

- [TESTING.md](/Users/oguzhanuyar/Desktop/fitnes-saas/TESTING.md)
