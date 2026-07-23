# Maestro Test Envanteri

Son güncelleme: 22 Temmuz 2026

Bu belge `apps/mobile/tests/e2e/maestro` altındaki 78 YAML dosyasını
dosya adına göre değil, gerçekte doğruladığı davranışa göre sınıflandırır.
Geçmişteki 68 dosyalık envanter güncel değildir.

## Sonuç sınıfları

- **Fonksiyonel E2E adayı:** Gerçek uygulama ekranında iş adımı tamamlar ve
  kullanıcıya görünen sonucu doğrular. Release kanıtı olabilmesi için izole
  veri, başarılı güncel koşu ve kritik mutasyonlarda API/DB kanıtı gerekir.
- **Smoke / görünürlük:** Ekranın veya kontrolün açıldığını doğrular; iş
  sonucunu kanıtlamaz.
- **Deep-link / yönlendirme:** URL, QR bağlamı, rol koruması veya geri
  navigasyonu doğrular; tek başına iş akışı sonucu değildir.
- **Pazarlama:** Ekran görüntüsü veya ürün hikâyesi üretir.
- **Push / native:** Cihaz izin ve bildirim orkestrasyonudur; gerçek cihaz
  kanıtı ayrı tutulur.
- **Dayanıklılık:** Offline/online gibi çevresel davranışı doğrular.

## Güncel özet

| Sınıf | Dosya | Release fonksiyonel kapısı |
| --- | ---: | --- |
| Fonksiyonel E2E adayı | 22 | Güncel koşu + gerekli API/DB kanıtıyla |
| Smoke / görünürlük | 27 | Hayır |
| Deep-link / yönlendirme | 17 | Ayrı kapı |
| Pazarlama | 5 | Hayır |
| Push / native | 6 | Fiziksel cihaz paketinde |
| Dayanıklılık | 1 | Ayrı kapı |
| **Toplam** | **78** | |

## Fonksiyonel E2E adayları — 22

| Dosya | Gerçek kapsam | Eksik kanıt |
| --- | --- | --- |
| `admin-approval-functional.yaml` | Yönetici bekleyen talebi kabul eder | DB durum kanıtı |
| `admin-campaign-notification-functional.yaml` | Kampanya oluşturur, pasifleştirir ve bildirim şablonu gönderir | Kampanya ve bildirim event DB kanıtı |
| `admin-entry-scan-functional.yaml` | Manuel salon giriş kodunu kaydeder | Check-in/attendance DB kanıtı |
| `admin-group-class-approval-functional.yaml` | Grup dersi talebini onaylar | Tek başına fixture ve DB kanıtı |
| `admin-package-create-smoke.yaml` | Paket oluşturur, düzenler, pasifleştirir ve siler | Her ara durumun API/DB kanıtı |
| `admin-salon-settings-functional.yaml` | Salon profilini ve çalışma gününü günceller | Settings DB kanıtı |
| `clinic-owner-activation-flow.yaml` | Klinik aktivasyonunun 1/4–4/4 adımlarını tamamlar | API doğrulama scripti mevcut; güncel regresyon gerekli |
| `duo-package-flow.yaml` | Keşiften duo paket başvurusu gönderir | Başvuru/paket/partner DB kanıtı |
| `login-role-routing.yaml` | Danışan gerçek giriş formunu tamamlar | Oturum API kanıtı yeterli; güncel koşu gerekli |
| `member-clinic-connection-functional.yaml` | Manuel QR, klinik seçimi, başka klinik ve bağlantı iptalini kullanır | Kalıcı iş sonucu üretmeyen bölümler ayrı raporlanmalı |
| `member-core-operations-functional.yaml` | Haklar, randevu iptali, grup katılımı, kampanya, bildirim tercihi ve klinikten ayrılma | DB doğrulama scripti mevcut |
| `member-measurement-smoke.yaml` | Ölçüm oluşturur ve geçmişte notuyla görür | DB kaydı son koşuda ayrıca doğrulandı |
| `member-multi-package-time-selection-authenticated.yaml` | Gerçek çoklu paket başvurusu gönderir | Başvuru ve slot DB kanıtı |
| `member-referral-functional.yaml` | Referans oluşturur ve listede görür | DB kaydı son koşuda ayrıca doğrulandı |
| `release-admin-login.yaml` | Yönetici gerçek giriş formunu tamamlar | Güncel koşu gerekli |
| `release-edge-cases.yaml` | Ek paket, rol koruması, yönetici ret ve hatalı giriş | Senaryolar ayrı fixture/API/DB kanıtına ayrılmalı |
| `release-trainer-login.yaml` | Eğitmen gerçek giriş formunu tamamlar | Güncel koşu gerekli |
| `trainer-daily-operations.yaml` | Not oluşturur/düzenler ve saat değişikliği talebi gönderir | Not ve talep DB kanıtı |
| `trainer-group-classes-full-smoke.yaml` | Grup dersi oluşturma/düzenleme/silme talebi zinciri | Her kararın DB kanıtı |
| `trainer-group-classes-smoke.yaml` | Grup dersi talebi oluşturur | Talep DB kanıtı |
| `trainer-manual-checkin-smoke.yaml` | Manuel check-in gerçekleştirir | Attendance ve hak düşümü DB kanıtı |
| `trainer-operations-functional.yaml` | Paket/kazanç/risk yüzeyleri, toplu bildirim ve çıkış | Okuma yüzeyleri smoke; bildirim event DB kanıtı gerekli |

`trainer-operations-functional.yaml` tek dosyada hem smoke hem mutasyon içerir.
Release raporunda yalnızca toplu bildirim ve çıkış bölümü fonksiyonel işlem
olarak sayılmalıdır.

## Smoke / görünürlük — 27

```text
admin-calendar-smoke.yaml
admin-clinic-qr-smoke.yaml
admin-group-class-approvals-smoke.yaml
admin-group-class-cancel-approval-smoke.yaml
admin-group-class-create-approval-smoke.yaml
admin-owner-setup.yaml
admin-package-group-link-smoke.yaml
admin-subscription-flow.yaml
admin-trainer-profile-smoke.yaml
group-class-e2e.yaml
group-class-participants-and-package-smoke.yaml
member-bookings-smoke.yaml
member-calendar-smoke.yaml
member-group-classes-smoke.yaml
member-intake-package-recommendation.yaml
member-multi-package-time-selection.yaml
member-onboarding.yaml
member-package-renewal-smoke.yaml
phase-three-admin-report-smoke.yaml
phase-three-member-progress-smoke.yaml
phase-three-trainer-tools-smoke.yaml
trainer-calendar-smoke.yaml
trainer-group-class-delete-request-smoke.yaml
trainer-invite-signup.yaml
trainer-profile-assigned-lessons-smoke.yaml
trainer-today-smoke.yaml
welcome-clinic-entry.yaml
```

## Deep-link / yönlendirme — 17

```text
admin-approvals-smoke.yaml
admin-salon-qr-ignored.yaml
debug-intake-packages.yaml
member-clinic-connection-smoke.yaml
member-discovery-preserves-profile.yaml
member-salon-detour-deeplink.yaml
member-salon-detour-path-slug-only.yaml
member-salon-detour-register-flow.yaml
member-salon-detour-salons-host.yaml
member-salon-detour-warm-app.yaml
member-salon-qr-block-active-member.yaml
member-salon-qr-deeplink-smoke.yaml
member-salon-qr-invalid-salon.yaml
member-salon-qr-own-active-member.yaml
mobile-back-navigation-smoke.yaml
subscription-value-proof.yaml
trainer-salon-qr-ignored.yaml
```

## Pazarlama — 5

```text
admin-subscription-screenshot.yaml
marketing-admin-screenshots.yaml
marketing-member-screenshots.yaml
marketing-product-story.yaml
marketing-trainer-screenshots.yaml
```

## Push / native — 6

```text
push/open-and-assert.yaml
push/permission-denied.yaml
push/prepare-background.yaml
push/prepare-foreground.yaml
push/prepare-terminated.yaml
push/role-login-and-register.yaml
```

## Dayanıklılık — 1

- `connectivity-offline-recovery.yaml`: offline banner, tekrar dene ve online
  toparlanmayı doğrular. Özel E2E kontrol ekranı kullandığı için normal ürün
  navigasyon testi olarak sayılmaz.

## Güncel kanıt durumu

- `member-core-operations-functional.yaml`: 20 Temmuz 2026 son koşusu geçti;
  hak, iptal, grup talebi, bildirim tercihi ve üyelik DB doğrulaması geçti.
- `member-measurement-smoke.yaml`: ilk koşuda ölçüm notu UI'da yoktu; ürün
  düzeltmesinden sonraki koşu geçti ve DB kaydı doğrulandı.
- `member-referral-functional.yaml`: ilk koşular form/kaydırma nedeniyle
  başarısız oldu; son düzeltilmiş koşu 38 saniyede geçti ve DB kaydı görüldü.
- Diğer dosyalar, kod ve fixture değişikliklerinden sonra tek bir güncel tam
  regresyonda yeniden çalıştırılmadan `passed` sayılmaz.

## Release raporlama kuralı

1. Dosyanın geçmişte bir kez geçmesi güncel release kanıtı değildir.
2. UI sonucu üreten kritik mutasyonlarda API veya PostgreSQL kanıtı gerekir.
3. Smoke, deep-link, pazarlama ve push sayıları fonksiyonel başarı sayısına
   eklenmez.
4. Bir dosyada smoke ve mutasyon birlikteyse sonuçlar ayrı satırlarda
   raporlanır.
5. Başarısız olmuş fakat sonradan düzeltilmiş akışın hem ilk hata nedeni hem
   de son başarılı kanıtı raporda korunur.
