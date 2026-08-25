# Mobil release regresyon raporu — 12 Ağustos 2026

## Karar

**iOS Simulator için READY. Fiziksel cihaz release kapısı ayrıca çalıştırılmalı.**

Ana fonksiyonel kabul matrisi temiz ve tek koşuda `31/31` geçti. Bu koşuda her senaryo öncesi PostgreSQL reset+seed edildi; ilgili senaryolarda API ve DB verifier'ları da çalıştı. Fiziksel iPhone üzerinde bu oturumda koşu yapılmadığı için gerçek cihaz sonucu hakkında `%100 geçti` iddiası yoktur.

## Doğrulanan ortam

- Uygulama: `com.fizyoflow.mobile`, Expo development client
- Simülatör: iPhone 16 Pro, iOS 18.2
- Simülatör UDID: `0A017005-6F4E-48BD-ADC8-431D294C5A1B`
- API: gerçek Docker API, `http://127.0.0.1:4949/api`
- Veritabanı: PostgreSQL 16, izole E2E veritabanı
- Maestro CLI: 2.3.0

## Sonuçlar

| Kapı | Sonuç |
| --- | --- |
| Fonksiyonel E2E matrisi | `31/31 passed`, `0 failed` |
| Fonksiyonel matris doğrulayıcı | `31 rows`, `0 failures` |
| Release rol matrisi syntax | `40/40 passed` |
| Üye kritik rol matrisi | `15/15 passed`, `0 failed` |
| Shared/admin/trainer kritik kapsam | İlk tam taramada bütün akışlar geçti; kalan grup dersi silme akışı düzeltme sonrası hedefli geçti |
| TypeScript | passed |
| ESLint | passed |
| Unit test | `59/59 files`, `269/269 tests passed` |
| Diff whitespace kontrolü | passed |

## Kapsanan kritik alanlar

- Klinik sahibi, eğitmen ve danışan kayıt/login/routing/logout
- iOS parola/autofill davranışına dayanıklı kayıt, davet ve parola sıfırlama
- Klinik aktivasyonu 1/4–4/4, paket oluşturma, çalışma saatleri ve QR
- Üç rollü randevu/takvim zinciri; onay, saat değişikliği, iptal, kapasite ve çakışma
- Paket CRUD, duo ve çoklu paket başvuruları, ek paket satın alma yolu
- Yönetici onayları, kampanya/bildirim, risk, gelir ve abonelik yüzeyleri
- Eğitmen günlük operasyonları, grup dersi create/edit/delete, manuel check-in
- Danışan ölçüm, paket hakkı, grup dersi, kampanya, bildirim ayarları ve salondan ayrılma
- Klinik keşfi, QR, geçersiz klinik ve aktif üyeyken başka klinik bağlamını engelleme

## Task 10 sırasında kapatılan son nedenler

- Üye grup dersi iptal verifier'ındaki `CANCELED` / `CANCELLED` sözleşme uyuşmazlığı giderildi.
- Release rol runner'ı her flow ve retry öncesi DB reset+seed yapacak şekilde izole edildi.
- Senaryoya özel fixture gerektiren eğitmen günlük operasyon ve manuel check-in release matrisine bağlandı.
- `launchApp(clearState)` sonrasında deep-link'i erken gönderen legacy akışlara welcome hazır-olma bariyeri eklendi.
- Admin eğitmen profilinde metin tabanlı `Detayı gör` seçicisi deterministik test ID'ye çevrildi.
- Grup dersi silme smoke'u, iç akışın güncellediği gerçek ders adı/test ID'siyle eşleştirildi.

## Bilinen altyapı notu

Uzun kritik matris taramasında Maestro/XCUITest bir kez `kAXErrorInvalidUIElement`, daha önce de `NSPOSIXErrorDomain code=60` deep-link RPC timeout'u verdi. Deep-link aynı anda `simctl` ile açıldı ve uygulama doğru ekrana geçti; bu durum uygulama assertion hatası olarak sınıflandırılmadı. Hazır-olma bariyerleri eklendi, runner retry ve deterministik reset ile güçlendirildi.

## Fiziksel cihaz için kalan release kapısı

Gerçek iPhone'da en az kayıt/parola autofill, bildirim izni, QR kamera, deep-link, klavye/scroll, uygulamayı arka plana alma ve release build açılışı doğrulanmalıdır. Bu fiziksel cihaz smoke'u geçmeden rapor yalnız simülatör için READY kabul edilir.
