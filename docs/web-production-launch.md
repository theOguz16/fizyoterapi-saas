# Fizyoflow Web Production Launch

Bu doküman `fizyoflow.com`, `app.fizyoflow.com`, `api.fizyoflow.com` ve `*.fizyoflow.com` wildcard klinik vitrinlerini VDS üzerinde Docker Compose ile yayına almak için hazırlanmıştır.

## Kapsam

- `fizyoflow.com`: ana ürün sitesi, demo lead formu, legal sayfalar, analytics rıza akışı.
- `app.fizyoflow.com`: admin/web panel.
- `api.fizyoflow.com`: API.
- `*.fizyoflow.com`: klinik public vitrinleri.

İlk fazda tüm wildcard subdomain'ler klinik/işletme vitrini olarak çalışır; ayrı eğitmen public modeli yoktur.

## DNS

Cloudflare DNS kayıtları:

- `A fizyoflow.com -> VDS_IP`
- `A www -> VDS_IP`
- `A app -> VDS_IP`
- `A api -> VDS_IP`
- `A * -> VDS_IP`

Wildcard SSL için Cloudflare API token gerekli:

- Zone DNS Edit yetkisi
- Sadece `fizyoflow.com` zone kapsamı

## Env

Sunucuda `.env.production.vds.example` dosyasını `.env.production` olarak kopyalayın ve değerleri doldurun:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PRODUCTION_CORS_ORIGIN`
- `NEXT_PUBLIC_WEB_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_BASE`
- `ACME_EMAIL`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_IOS_APP_URL` opsiyonel
- `NEXT_PUBLIC_ANDROID_APP_URL` opsiyonel
- `NEXT_PUBLIC_GA_ID` opsiyonel
- `NEXT_PUBLIC_POSTHOG_KEY` opsiyonel
- `NEXT_PUBLIC_POSTHOG_HOST` opsiyonel
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` opsiyonel
- `NEXT_PUBLIC_BING_SITE_VERIFICATION` opsiyonel

Production compose lokal `.env` dosyasındaki development CORS değerlerini okumaması için `PRODUCTION_CORS_ORIGIN` kullanır.

Önerilen CORS değeri:

```txt
https://app.fizyoflow.com,https://fizyoflow.com,https://www.fizyoflow.com
```

Önerilen web public env değerleri:

```txt
NEXT_PUBLIC_WEB_BASE_URL=https://fizyoflow.com
NEXT_PUBLIC_APP_URL=https://app.fizyoflow.com
NEXT_PUBLIC_API_BASE=https://api.fizyoflow.com/api
```

## Deploy

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

İlk açılışta Caddy Cloudflare DNS challenge ile sertifika alır. Wildcard DNS propagasyonu birkaç dakika sürebilir.

## Veritabanı

Production deploy `DB_SYNC=false` ile çalışır. Canlı öncesinde şema/migration stratejisi net olmalıdır:

- Mevcut production DB yoksa ilk kurulum script'i kontrollü çalıştırılmalı.
- Mevcut production DB varsa migration/backfill planı hazırlanmalı.
- İlk canlı deploy öncesi yedek alınmalı.
- `POSTGRES_PASSWORD` ve `JWT_SECRET` gerçek güçlü değerlerle değiştirilmelidir.

## Smoke

En az bir public pilot klinik slug'ı ile çalıştırın:

```bash
WEB_BASE_URL=https://fizyoflow.com \
API_BASE_URL=https://api.fizyoflow.com/api \
ADMIN_BASE_URL=https://app.fizyoflow.com \
PUBLIC_SMOKE_SLUG=atlasfizyo \
pnpm smoke:web:prod
```

Lead kayıtlarını da gerçek uçtan uca doğrulamak için:

```bash
WEB_SMOKE_SUBMIT_LEADS=1 \
WEB_BASE_URL=https://fizyoflow.com \
API_BASE_URL=https://api.fizyoflow.com/api \
ADMIN_BASE_URL=https://app.fizyoflow.com \
PUBLIC_SMOKE_SLUG=atlasfizyo \
pnpm smoke:web:prod
```

Smoke beklenenleri:

- API health 200 döner.
- Ana ürün sitesi 200 döner ve kurulum/yayın hazırlığı içeriklerini taşır.
- Admin login 200 döner ve giriş ekranı içeriği gelir.
- Sitemap ve robots 200 döner.
- Pilot klinik subdomain'i 200 döner ve klinik lead/iletişim içerikleri gelir.
- Join redirect sayfası 200 döner.
- Public event endpoint'i 200/202 döner.
- `WEB_SMOKE_SUBMIT_LEADS=1` verilirse ürün demo lead'i, klinik lead'i ve lead submit event'i de test edilir.

Kod tarafı canlı öncesi kalite kapısı:

```bash
pnpm --filter @fitnes-saas/web build
pnpm --filter @fitnes-saas/web typecheck
pnpm --filter @fitnes-saas/web preflight
WEB_PREFLIGHT_STRICT=1 pnpm --filter @fitnes-saas/web preflight
```

## Pilot Klinik İçeriği

İlk canlı yayından önce en az bir pilot klinikte şu alanlar dolu olmalı:

### Kimlik

- Klinik adı
- Slug: küçük harf, tireli, reserved slug olmayan değer
- Şehir/ilçe
- Kısa konum cümlesi
- Ana hizmet kategorisi

### İletişim

- Telefon
- WhatsApp numarası
- Adres
- Google Maps URL
- Google Business Profile URL
- Instagram URL
- Yorum isteme/review URL
- Çalışma saatleri

### İçerik

- Hero başlığı
- Kısa hero açıklaması
- SEO title
- SEO description
- Lokasyon odaklı kısa tanıtım metni
- Hizmetler: fizyoterapi, klinik pilates, reformer, rehabilitasyon, manuel terapi vb.
- Her hizmet için 1-2 cümlelik güven veren açıklama
- Kampanya/paylaşım notu
- Klinik logosu
- En az 3 gerçek galeri fotoğrafı

### Yayın Şartları

- `is_published=true`
- Tenant aktif
- Public review published
- Subscription active/trial
- Slug reserved listesinde değil
- Eksik bilgi checklist'i sıfır kritik eksik gösteriyor

## Operasyon

- Ürün sitesi demo formları `PRODUCT_SITE_DEMO_LEAD_SUBMIT` audit event'i olarak kaydedilir.
- Internal ekip `/api/internal/clinic-requests/demo-leads` endpoint'i ile demo taleplerini listeleyebilir.
- Klinik vitrin eventleri backend'de `PUBLIC_SITE_*` olarak saklanır.
- GA4/PostHog anahtarları girilirse açık rıza sonrası harici analytics de çalışır.
- Analytics eventlerine sağlık verisi, form notu veya hassas kişisel veri yazılmamalıdır.
- Klinik lead formları sadece iletişim ve ilgi alanı seviyesinde kalmalıdır.

## Canlı Öncesi Kontrol

- Logo, favicon ve OG görselleri doğru görünüyor.
- Ana ürün sitesi mobilde hero, demo formu ve CTA alanlarında taşmıyor.
- Klinik vitrin mobilde WhatsApp/telefon/harita CTA'larını görünür tutuyor.
- Legal linkler footer'da görünüyor.
- Cookie/analytics bildirimi env yokken görünmüyor, env varken rıza istiyor.
- Demo lead honeypot doluyken sessiz reddediliyor.
- Public klinik lead formunda KVKK/onay olmadan gönderim yapılmıyor.
- Reserved subdomain'ler klinik sayfası açmıyor.
- Yayında olmayan klinik 404 veriyor.
- Sitemap canlı domainlerle doğru URL üretiyor.
- Cloudflare proxy/DNS ayarı Caddy DNS challenge'ı bozmayacak şekilde doğrulandı.

## Canlı Öncesi Not

Legal sayfalar yayın öncesi taslaktır. Canlı kullanım öncesi şirket/iletişim bilgileri ve hukuki metinler son kez gözden geçirilmelidir.
