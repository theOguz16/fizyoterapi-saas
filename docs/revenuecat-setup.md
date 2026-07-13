# RevenueCat Setup

Bu repo tarafinda kod entegrasyonu hazirlandi. Dashboard ve store tarafinda su isimleri kullan:

## RevenueCat

- Project: `FizyoFlow`
- Entitlement: `clinic_pro`
- Offering: `default`
- Packages:
  - `monthly`
  - `annual`

## Store product IDs

- iOS:
  - `fizyoflow_admin_monthly`
  - `fizyoflow_admin_yearly`
- Android:
  - `fizyoflow_admin_monthly`
  - `fizyoflow_admin_yearly`

## Trial modeli

- Uygulama ici klinik trial suresi: `21 gun`
- Trial once admin tarafinda uygulama icinden baslatilir.
- Satin alma yine admin tarafinda uygulama icinden yapilir.
- `member` ve `trainer` odeme yapmaz.
- `appUserID` olarak `tenant.id` kullanilir.

Bu modelde trial, abonelik satin alinmadan once backend tarafindan klinige tanimlanir. Ayni kullaniciya arka arkaya iki deneme verilmemesi icin App Store Connect ve Google Play Console'daki `monthly` / `annual` urunlerine ek bir free trial veya introductory trial baglanmamalidir. RevenueCat satin alma ve entitlement senkronizasyonunu yonetir; 21 gunluk uygulama ici trial'i baslatmaz. Store tarafinda daha once bir introductory offer tanimlandiysa production yayinindan once kaldirilmali ve yeni bir sandbox hesabi ile satin alma ekrani kontrol edilmelidir.

Store dogrulama kaynaklari:

- [Apple: Auto-renewable subscription introductory offer kurulumu](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)
- [RevenueCat: Free trials ve introductory offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers)

## Mobil env

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...`
- `EXPO_PUBLIC_API_BASE=http://localhost:4949/api`

EAS production build icin bu iki public SDK key'i EAS environment'a eklenmeli:

```bash
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_...
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value goog_...
```

Bu key'ler build aninda native uygulamaya gomulur. App Store'daki mevcut build key'siz ciktiysa,
EAS env tanimlandiktan sonra yeni build alinip TestFlight/App Store'a gonderilmelidir.

## Backend env

- `REVENUECAT_WEBHOOK_AUTH=Bearer <secret>`
- `REVENUECAT_ENTITLEMENT_ID=clinic_pro`
- `REVENUECAT_REST_API_KEY=<RevenueCat secret API key>`

## Webhook

- URL: `POST /api/billing/revenuecat/webhook`
- Auth header: `Authorization: Bearer <secret>`

## Admin sync

- URL: `POST /api/admin/clinic/subscription/sync`
- Mobil uygulama purchase veya restore tamamlanınca bu endpoint'i çağırır.
- Backend `appUserID = tenant.id` ile RevenueCat REST API'den entitlement durumunu doğrular.
- `REVENUECAT_REST_API_KEY` yoksa endpoint satın almayı aktif saymaz, `PENDING_SYNC` döner ve webhook beklenir.

## Beklenen event etkileri

- `INITIAL_PURCHASE` -> `tenant.subscription_status = ACTIVE`
- `RENEWAL` -> `tenant.subscription_status = ACTIVE`
- `UNCANCELLATION` -> `tenant.subscription_status = ACTIVE`
- `EXPIRATION` -> `tenant.subscription_status = READ_ONLY`
