# Testing

Bu repo için test katmanları:

- `backend`: Vitest
- `admin-web`: Vitest + Playwright
- `mobile`: Vitest + Maestro smoke flows

## Hızlı Başlangıç

Tüm unit/integration testleri:

```bash
pnpm test
```

Parça parça çalıştırma:

```bash
pnpm --filter @fitnes-saas/api test
pnpm --filter @fitnes-saas/admin-web test
pnpm --filter @fitnes-saas/mobile test
```

## Admin-Web E2E

İlk kurulum:

```bash
cd apps/admin-web
npx playwright install
```

Seçenek 1: Playwright kendi server'ını başlatsın

```bash
pnpm --filter @fitnes-saas/admin-web test:e2e
```

Seçenek 2: Server'ı sen başlat, Playwright sadece bağlansın

Terminal 1:

```bash
E2E_AUTH_BYPASS=true pnpm dev:admin
```

Terminal 2:

```bash
cd apps/admin-web
E2E_BASE_URL=http://127.0.0.1:2929 pnpm test:e2e
```

Notlar:

- `E2E_BASE_URL` verilirse Playwright config içindeki `webServer` devre dışı kalır.
- `E2E_AUTH_BYPASS=true` server tarafında test cookie'lerinden sahte oturum üretir.
- Lokal port kullanımına izin vermeyen sandbox ortamlarda e2e bu yüzden çalışmaz.

## Mobile E2E

Maestro kurulumu:

```bash
brew install maestro
```

Not:

- Mobile e2e için gereken araç `mobile.dev` Maestro CLI'dir.
- `/Applications/Maestro.app` olarak görünen ayrı Electron uygulaması yeterli değildir.
- `pnpm test:e2e:mobile` komutunun çalışması için `maestro test ...` komutunun PATH'te olması gerekir.

Uygulama kimliği:

- iOS: `com.fizyoflow.mobile`
- Android: `com.fizyoflow.mobile`

Çalıştırma akışı:

1. iOS Simulator veya Android Emulator aç.
2. API'yi başlat:

```bash
pnpm dev:api
```

3. Mobil uygulamayı başlat:

```bash
EXPO_PUBLIC_API_BASE=http://127.0.0.1:4949/api pnpm dev:mobile
```

4. Uygulamayı cihazda aç.
5. Maestro smoke akışlarını çalıştır:

```bash
cd /Users/oguzhanuyar/Desktop/fitnes-saas
pnpm test:e2e:mobile
```

Doğrudan:

```bash
cd apps/mobile
pnpm test:e2e
```

Not:

- `pnpm test:e2e:mobile` sadece repo root script'i.
- `apps/mobile` içinde doğru script `pnpm test:e2e`.
- `appId: com.fizyoflow.mobile` olduğu için Maestro, Expo Go yerine development build / installed app ile daha stabil çalışır.

## Beklenen Kısıtlar

- Playwright için tarayıcı binary'leri kurulu olmalı.
- Maestro gerçek simulator/emulator veya bağlı cihaz ister.
- Port açma izni olmayan uzaktan sandbox ortamlarda sadece unit/integration katmanı koşabilir.
