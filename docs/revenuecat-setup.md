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

- Trial suresi: `5 gun`
- Trial once admin tarafinda uygulama icinden baslatilir.
- Satin alma yine admin tarafinda uygulama icinden yapilir.
- `member` ve `trainer` odeme yapmaz.
- `appUserID` olarak `tenant.id` kullanilir.

## Mobil env

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...`
- `EXPO_PUBLIC_API_BASE=http://localhost:4949/api`

## Backend env

- `REVENUECAT_WEBHOOK_AUTH=Bearer <secret>`
- `REVENUECAT_ENTITLEMENT_ID=clinic_pro`

## Webhook

- URL: `POST /api/billing/revenuecat/webhook`
- Auth header: `Authorization: Bearer <secret>`

## Beklenen event etkileri

- `INITIAL_PURCHASE` -> `tenant.subscription_status = ACTIVE`
- `RENEWAL` -> `tenant.subscription_status = ACTIVE`
- `UNCANCELLATION` -> `tenant.subscription_status = ACTIVE`
- `EXPIRATION` -> `tenant.subscription_status = READ_ONLY`
