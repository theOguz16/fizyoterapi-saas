# Release Gate

Bir sürüm ancak aşağıdaki kapıların tamamı geçtiğinde yayınlanabilir. `release:gate` komutu production erişimi, iki platformun EAS build kayıtları, kanıt dosyaları veya gerçek cihaz bağlantısı olmadan başarılı olmaz; bu kasıtlıdır. Repository kontrollerinin geçmesi tek başına yayın onayı değildir.

## Release kayıt özeti

Her satır bağımsız doğrulanır; bir alandaki kanıt başka alanın yerine kullanılamaz.

| Kapı | Zorunlu kanıt | Repository'de doğrulanabilir mi? |
| --- | --- | --- |
| Otomatik doğrulama | Test, typecheck, API/web preflight, web build, Maestro YAML syntax | Evet |
| Web production smoke | Canlı/staging HTTPS URL ve `smoke:web:prod` logu | Hayır, erişilebilir deploy gerekir |
| iOS EAS build | `production` profili, finished build ID ve Expo build URL'si | Hayır, EAS erişimi gerekir |
| Android EAS build | `production` profili, finished build ID ve Expo build URL'si | Hayır, EAS erişimi gerekir |
| Maestro kritik matris | Aynı EAS build ID'siyle iOS ve Android fiziksel cihaz log/video kaydı | Hayır, iki fiziksel cihaz gerekir |
| Push | İzin reddi, token kaydı ve iOS'ta 3 rol x 3 app-state receipt/tıklama kanıtı | Hayır |
| Deep link | iOS Universal Link/custom scheme ve Android App Link/custom scheme sonucu | Hayır |
| QR | Her iki platformda kamera ile gerçek QR tarama ve hedef salon sonucu | Hayır |
| RevenueCat | Her iki store sandbox'ında satın alma, entitlement ve backend sync kaydı | Hayır |
| Performans | Web ölçümü ve iki platform fiziksel cihaz trace/video kaydı | Hayır |

## 1. Otomatik sözleşme ve build

```sh
pnpm release:verify:automated
```

Bu komut API, mobil, web ve admin-web unit testlerini, typecheck'i, API/web preflight kontrollerini ve web production build'ini çalıştırır.

Eklenen `release:e2e:mobile:syntax` adımı kritik Maestro YAML dosyalarını cihaz açmadan parse eder. Bu sonuç akışların cihazda geçtiği anlamına gelmez.

## 2. EAS production build ön koşulları

Mobil release env kontrolü iki platformun API ve RevenueCat public SDK key'lerini doğrular:

```sh
MOBILE_RELEASE_PLATFORM=all pnpm release:env:mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

Her iki build `finished` olduktan sonra EAS build ID, Expo build URL'si, uygulama sürümü ve iOS build number / Android versionCode release kaydına yazılır. Preview/development build, production build kanıtı yerine geçmez.

## 3. Web production smoke

Deploy edilen web, API ve admin adreslerinde read-only smoke çalıştırılır. Lead oluşturan varyant ayrıca açıkça istenmedikçe kapalı tutulur:

```sh
WEB_BASE_URL=https://fizyoflow.com \
API_BASE_URL=https://api.fizyoflow.com/api \
ADMIN_BASE_URL=https://app.fizyoflow.com \
WEB_SMOKE_SUBMIT_LEADS=0 \
pnpm smoke:web:prod
```

Çıktı release evidence klasörüne kaydedilir. Local build veya yalnız preflight sonucu bu kapıyı karşılamaz.

## 4. Gerçek cihaz kritik akışları

TestFlight veya release candidate build'i açık bir iOS/Android cihazda Maestro'ya bağlayın ve çalıştırın:

```sh
pnpm release:e2e:mobile
```

Bu suite metin veya geniş regex yerine ürün ekranındaki `testID` değerlerini doğrular. Her release'te aşağıdaki kayıtlar test kanıtına eklenmelidir:

| Alan | Rol | Kanıt |
| --- | --- | --- |
| Giriş | Admin, trainer, member | Rolün ana ekranına giden Maestro videosu/logu |
| Salon bağlantısı | Member | Geçerli QR/deep link ile salon detayı ve paket aksiyonu |
| Paket | Admin | Paket oluşturma sonrası listede görünen kayıt |
| Rezervasyon | Admin, trainer, member | Takvimlerin yüklendiği ve aynı booking bağlamını gösterdiği kayıt |
| Check-in | Trainer | MEM kodu ile sonuç kartı |
| Rol değişimi | Admin + trainer yetkili tek hesap | `role-switch-trainer` ile hedef ana ekrana geçiş |
| Push | Admin, trainer, member | İzin, Expo token kaydı, bildirime dokunma ve hedef ekran videosu |

Dokuz kritik Maestro akışının tamamı hem iOS hem Android production EAS build üzerinde çalıştırılır. Her kayıtta platform, fiziksel cihaz modeli/OS sürümü, EAS build ID ve log/video yolu bulunur. Simülatör/emülatör syntax veya hızlı smoke için kullanılabilir fakat release kanıtı sayılmaz.

Deep link ve QR ayrı evidence alanlarıdır: deep link testi doğrudan URL açılışını, QR testi ise fiziksel kamera ile gerçek kod taramasını kanıtlar. `member-salon-qr-deeplink-smoke.yaml` otomatik akışı tek başına fiziksel QR kanıtının yerine geçmez.

Push testi simülatörde geçerli sayılmaz. Farklı role ait bir bildirim, yanlış rol ekranına düşmemeli; hedef id yoksa rol ana ekranına kontrollü dönmelidir. Bildirim payload sözleşmesi değişirse önce `apps/mobile/tests/unit/push.test.ts` güncellenir, ardından fiziksel cihaz matrisi tekrar çalıştırılır.

### Push kanıtının otomatik toplanması

Gerçek cihaz push testi admin, trainer ve member rollerinin her biri için foreground, background ve terminated durumlarını kapsar; toplam dokuz teslimat/tıklama senaryosu zorunludur. İzin reddi testi fresh-install durumda ayrı çalıştırılır:

```sh
PUSH_E2E_DEVICE_ID=000081... \
PUSH_E2E_EVIDENCE_DIR=release-evidence/push-ios-45 \
PUSH_E2E_MEMBER_EMAIL=... \
PUSH_E2E_MEMBER_PASSWORD=... \
pnpm --filter @fitnes-saas/mobile test:e2e:push:permission-denied
```

İzin iOS Ayarlar'dan tekrar açıldıktan sonra `apps/mobile/tests/e2e/README.md` içindeki rol değişkenleriyle matrix runner çalıştırılır:

```sh
pnpm --filter @fitnes-saas/mobile test:e2e:push:device
```

Runner bağlı ve kullanılabilir cihazı `xcrun devicectl` ile fiziksel iPhone olarak doğrular. Her senaryoda Expo ticket, Expo/APNs receipt, Maestro logu ve hedef ekran screenshot'ı üretir. Backend token kayıt sorgusunun rol, `registered` durumu, `isActive: true`, maskeli token sonu ve `checkedAt` alanlarını taşıyan JSON çıktısı her rol için `PUSH_E2E_<ROLE>_REGISTRATION_LOG` olarak verilmelidir; örnek sözleşme `apps/mobile/tests/e2e/README.md` içindedir.

Kanıtı bağımsız doğrulamak için:

```sh
PUSH_RELEASE_EVIDENCE=release-evidence/push-ios-45/push-release-evidence.json \
PUSH_RELEASE_BUILD='ios-1.2.3(45)' \
pnpm release:push:mobile
```

Doğrulayıcı fiziksel iPhone, TestFlight/production-like ortam, aynı build numarası, en fazla 72 saatlik kanıt, izin reddi, üç rol token kaydı ve dokuz başarılı receipt/tıklama sonucunun tamamını zorunlu tutar.

## 5. Web Core Web Vitals bütçesi

Staging veya production URL'si üzerinde Chromium ile ölçün:

```sh
WEB_PERF_URL=https://fizyofloww.com \
WEB_PERF_INTERACTION_SELECTOR='a[href="#product"]' \
pnpm release:performance:web
```

Varsayılan bütçeler: FCP `<= 1.8 s`, LCP `<= 2.5 s`, CLS `<= 0.10`, sentetik etkileşim gecikmesi `<= 200 ms`. Eşikler yalnızca ilgili ortamı temsil eden ölçümle sıkılaştırılabilir; gevşetmek için release notunda gerekçe ve önceki ölçüm gerekir. INP alan verisi olduğundan, gerçek kullanıcı takibi aktifse aynı sürüm için p75 INP `<= 200 ms` ayrıca release kaydına eklenir.

## 6. Mobil performans bütçesi

Cold start, warm start ve uzun liste kaydırmasını release candidate üzerinde ölçün. iOS'ta Instruments Time Profiler + Core Animation, Android'te Macrobenchmark/Perfetto kullanın. Kaydırma senaryosu: girişten sonra en az 100 kayıt içeren üye veya rezervasyon listesini baştan sona üç kez kaydırın.

`mobile-performance.json` örneği:

```json
{
  "build": "ios-1.0.1(21)",
  "measuredAt": "2026-07-14T10:00:00.000Z",
  "platforms": {
    "ios": {
      "device": "iPhone 14",
      "osVersion": "iOS 18.6",
      "coldStartMs": 2450,
      "warmStartMs": 920,
      "listScrollFps": 59,
      "droppedFramePercent": 1.8,
      "recording": "release-evidence/ios-scroll.mp4",
      "profileArtifact": "release-evidence/ios-trace.trace"
    }
  }
}
```

```sh
MOBILE_PERFORMANCE_EVIDENCE=release-evidence/mobile-performance.json \
MOBILE_PERFORMANCE_PLATFORMS=ios \
pnpm release:performance:mobile
```

Bütçeler: cold start `<= 3000 ms`, warm start `<= 1500 ms`, liste kaydırma `>= 55 FPS`, dropped-frame oranı `<= %5`. Android sürümü yayınlanıyorsa `MOBILE_PERFORMANCE_PLATFORMS=ios,android` kullanılır ve iki fiziksel cihaz sonucu zorunludur.

## Tam yayın kapısı

`docs/release-evidence.template.json` kopyalanıp ilgili sürümün evidence klasörüne alınır. Şablondaki `pending` ve boş alanlar gerçek çalıştırma sonuçlarıyla doldurulmadan kapı geçmez. `RELEASE_EVIDENCE` JSON dosyası `schemaVersion`, `release`, `webSmoke`, `builds.ios`, `builds.android`, `maestro.ios`, `maestro.android`, `push`, `deepLink`, `qr` ve `revenueCat` alanlarını içerir. Artifact alanları boş olmayan gerçek log/video/screenshot dosyalarını göstermelidir. RevenueCat satırlarında store sandbox transaction ID bulunur. `pnpm release:evidence` bu alanları, iki production EAS build URL'sini, dokuz akışın iki platformda build ID eşleşmesini ve kanıt dosyalarının varlığını doğrular.

Push JSON'u ayrıca mevcut `pnpm release:push:mobile` doğrulayıcısından geçer; birleşik manifestte `passed` yazılması bu ayrıntılı doğrulamanın yerine geçmez.

Ortam değişkenleri ve gerçek cihaz kanıtı hazır olduğunda:

```sh
WEB_PERF_URL=https://staging.fizyofloww.com \
WEB_PERF_INTERACTION_SELECTOR='a[href="#product"]' \
RELEASE_EVIDENCE=release-evidence/release-1.2.3.json \
MOBILE_PERFORMANCE_EVIDENCE=release-evidence/mobile-performance.json \
MOBILE_PERFORMANCE_PLATFORMS=ios,android \
PUSH_RELEASE_EVIDENCE=release-evidence/push-ios-45/push-release-evidence.json \
PUSH_RELEASE_BUILD='ios-1.2.3(45)' \
pnpm release:gate
```

Bu komut hata verirse sürüm yayınlanmaz. Başarılı koşuda web smoke, iOS/Android EAS build, Maestro, push, deep-link, QR, RevenueCat ve performans kanıtları aynı release kimliği altında saklanır.
