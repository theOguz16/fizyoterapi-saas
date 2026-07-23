# Mobil Ürün Kapsam Matrisi

Son güncelleme: 23 Temmuz 2026

Bu belge mobil uygulamanın aktif kullanıcı yüzeylerini, mevcut otomasyon
durumunu ve gerekli en küçük test katmanını tanımlar. `M` Maestro, `I` gerçek
PostgreSQL integration, `U` unit, `S` smoke/contract, `D` fiziksel cihaz
anlamına gelir.

## Durumlar

- `KANIT_VAR`: Güncel veya yakın tarihli başarılı UI ve gerekli veri kanıtı var.
- `KISMI`: Yüzey veya işlemin yalnızca bir bölümü doğrulanıyor.
- `YOK`: Gerçek fonksiyonel otomasyon yok.
- `BLOCKED`: Ürün/backend özelliği tamamlanmadan test edilemez.
- `CIHAZ`: Simülatör tek başına yeterli değildir.
- `ALIAS`: Eski URL'dir; güncel aktif route'a yönlendirir.

## Route erişilebilirliği

| Grup | Durum | Açıklama |
| --- | --- | --- |
| `(admin)` | AKTİF | 5 tab ve 20 gizli detay route'u registry içinde tanımlı |
| `(trainer)` | AKTİF | 5 tab ve 13 mevcut gizli detay route'u tanımlı |
| `(member)` | AKTİF | 5 tab ve 10 gizli detay route'u tanımlı |
| `(auth)` | AKTİF | Welcome, giriş, kayıt, davet, QR, izin ve şifre yenileme |
| `(intake-member)` | AKTİF | Klinik keşfi, paket, eğitmen, saat, özet ve bekleme |
| `(shared)` | AKTİF | Klinikler, davet, ayrılma ve bildirim tercihleri |
| `(setup)` | ALIAS | 13 eski route güncel admin/intake ekranlarına `Redirect` yapıyor |
| `(owner-setup)` | ALIAS | 2 eski route `/(admin)/salon/setup` ekranına yönlendiriyor |
| `join/[slug]` | AKTİF KÖPRÜ | Web/QR linkini intake klinik detayına taşır |
| `e2e-*` | TEST-ONLY | Production özelliği veya kullanıcı ekranı değildir |

`(setup)` ve `(owner-setup)` ayrı ürün özelliği olarak test edilmeyecek;
yalnızca eski bağlantıların doğru aktif route'a yönlenmesi bir deep-link
uyumluluk testiyle korunacaktır.

## Kimlik doğrulama ve onboarding

| ID | Ekran / işlem | Mevcut | Gerekli | Durum |
| --- | --- | --- | --- | --- |
| AUTH-01 | Welcome giriş/kayıt/QR/davet yönlendirmeleri | Smoke | M | KISMI |
| AUTH-02 | Yönetici gerçek giriş | Maestro | M+S | KISMI |
| AUTH-03 | Eğitmen gerçek giriş | Maestro | M+S | KISMI |
| AUTH-04 | Danışan gerçek giriş | Maestro | M+S | KISMI |
| AUTH-05 | Hatalı şifre ve kullanıcı mesajı | Edge Maestro | M+I | KISMI |
| AUTH-06 | Eksik/geçersiz form alanları | Yok | M+U | YOK |
| AUTH-07 | Klinik sahibi kayıt + legal consent | Maestro + hesap/consent/login DB/API verifier | M+I | KANIT_VAR |
| AUTH-08 | Danışan klinik bağlantılı kayıt | Maestro + hesap/consent/login DB/API verifier | M+I | KANIT_VAR |
| AUTH-09 | Eğitmen davet kabulü | Gerçek admin daveti + Maestro + DB/API verifier | M+I | KANIT_VAR |
| AUTH-10 | Çıkış ve token/push temizliği | Maestro + `AUTH_LOGOUT` audit + yeniden login | M+I | KANIT_VAR |
| AUTH-11 | Rol değiştirme ve yeni rol tokenı | Yönetici→eğitmen Maestro + aktif membership context | M+I | KANIT_VAR |
| AUTH-12 | Hesap kalıcı silme ve çift onay | UI mevcut | M+I | YOK |
| AUTH-13 | Bildirim izni ver/atla | Maestro parçaları | M+D | KISMI |
| AUTH-14 | Face ID/Touch ID butonsuz otomatik başlangıç | Butonsuz otomatik politika + unit; native prompt cihaz bekliyor | U+M+D | CIHAZ |
| AUTH-15 | Biyometri başarısız/iptal → şifre fallback | Politika/unit doğrulandı; native iptal cihaz bekliyor | U+M+D | CIHAZ |
| AUTH-16 | Biyometri tokenı geçersiz → güvenli şifre fallback | Güvenli fallback unit doğrulandı; cihaz kanıtı bekliyor | U+I+M | KISMI |
| AUTH-17 | Şifre sıfırlama istek/token/yeni şifre | Gerçek token tablosu + Maestro + DB/API verifier | I+M | KANIT_VAR |
| AUTH-18 | Yasal bağlantıların açılması | UI mevcut | S+D | YOK |

## Klinik aktivasyonu ve abonelik

| ID | Ekran / işlem | Mevcut | Gerekli | Durum |
| --- | --- | --- | --- | --- |
| ACT-01 | Klinik adı, şehir, ilçe, telefon, açıklama, rol | Tek-parça Maestro + API/DB verifier | M+I | KANIT_VAR |
| ACT-02 | Eksik/geçersiz klinik formu | Controller testleri | M+I | YOK |
| ACT-03 | İlk paket tüm alanları | Gerçek kategori/alt tür + ad/hak/süre/fiyat/komisyon + DB | M+I+U | KANIT_VAR |
| ACT-04 | Paket türü/kategori/kapasite/fiyat/hak/komisyon | Maestro + paket API kaydı + helper unit | M+I+U | KANIT_VAR |
| ACT-05 | Çalışma gün/saat/mola/slot kaydı | Pazartesi–Cuma kaydı + API/DB verifier | M+I+U | KANIT_VAR |
| ACT-06 | QR oluşumu ve plan ekranına geçiş | Tek-parça Maestro + QR/subscription API verifier | M+I | KANIT_VAR |
| ACT-07 | Aktivasyon adımından çıkış ve devam etme | Yok | M+I | YOK |
| ACT-08 | Çift tıklama/yavaş API/timeout/idempotency | Yok | I+M | YOK |
| SUB-01 | Trial başlatma | Mock ağırlıklı controller testi | I+M | YOK |
| SUB-02 | Paywall ürün ve teklif gösterimi | Unit + smoke | U+M | KISMI |
| SUB-03 | RevenueCat satın alma ve entitlement | Unit | I+D | CIHAZ |
| SUB-04 | Webhook idempotency ve tenant lifecycle | Mock testleri | I | YOK |
| SUB-05 | Satın alma geri yükleme | Unit + UI | I+D | CIHAZ |
| SUB-06 | Abonelik yenileme/iptal/read-only | Mock testleri | I+D | YOK |
| SUB-07 | Abonelik geçmişi | Ekran var | M+I | YOK |
| SUB-08 | EULA/gizlilik bağlantıları | UI var | S+D | YOK |

## Yönetici operasyonları

| ID | Özellik | Mevcut | Gerekli | Durum |
| --- | --- | --- | --- | --- |
| ADM-01 | Dashboard bütün hızlı işlemler | Bazıları kullanılıyor | M | KISMI |
| ADM-02 | Takvim liste/filtre/detay | Smoke | M+S | KISMI |
| ADM-03 | Randevu oluştur/güncelle/saat/durum | Yönetici oluşturma + üç rollü Maestro + API/DB guard doğrulaması | M+I+U | KANIT_VAR |
| ADM-04 | Üye/eğitmen arama ve detay sekmeleri | Smoke | M+S | KISMI |
| ADM-05 | Üyeye paket ata/hak ayarla/paket kaldır | API/UI var | M+I+U | YOK |
| ADM-06 | Paket CRUD | Maestro | M+I+U | KISMI |
| ADM-07 | Paket–eğitmen atama/kaldırma | Smoke | M+I | KISMI |
| ADM-08 | Mobil onay kabul/ret | Maestro | M+I | KISMI |
| ADM-09 | Grup dersi oluşturma/iptal onayları | Parçalı Maestro | M+I | KISMI |
| ADM-10 | Kampanya CRUD ve ödül üretimi | Oluştur/pasifleştir UI | M+I+U | KISMI |
| ADM-11 | Bildirim şablonu ve gerçek event | UI sonucu | M+I+D | KISMI |
| ADM-12 | Risk havuzu | Görünürlük | M+I+U | KISMI |
| ADM-13 | Gelir detayı, filtre ve hesaplar | Smoke | M+I+U | KISMI |
| ADM-14 | CSV dosya üretimi/içeriği | Buton görünürlüğü | I+M | YOK |
| ADM-15 | Salon profili ve dijital vitrin | Maestro başlık güncelleme | M+I+S | KISMI |
| ADM-16 | Çalışma saatleri bütün alanlar | Tek gün değişimi | M+I+U | KISMI |
| ADM-17 | Manuel giriş tarama | Maestro | M+I | KISMI |
| ADM-18 | Kamera QR giriş tarama | UI var | M+I+D | CIHAZ |
| ADM-19 | Klinik QR paylaşma/kaydetme | Smoke | M+D | CIHAZ |
| ADM-20 | Fiyat ve komisyon ayarları | UI/API var | M+I+U | YOK |

## Eğitmen operasyonları

| ID | Özellik | Mevcut | Gerekli | Durum |
| --- | --- | --- | --- | --- |
| TRN-01 | Ana ekran bütün hızlı işlemler | Kısmi | M | KISMI |
| TRN-02 | Bugünkü seanslar ve detay | Smoke | M+S | KISMI |
| TRN-03 | Takvim ve filtreler | Smoke | M+S | KISMI |
| TRN-04 | Randevu oluştur/durum değiştir | API/UI var | M+I+U | YOK |
| TRN-05 | Saat değişikliği talebi | Gerçek randevu üzerinden ret ve sonraki kabul zinciri | M+I | KANIT_VAR |
| TRN-06 | Randevu iptal talebi | Kontrol görünür | M+I | YOK |
| TRN-07 | Manuel check-in ve hak düşümü | Maestro UI | M+I+U | KISMI |
| TRN-08 | QR check-in | UI/API var | M+I+D | CIHAZ |
| TRN-09 | Danışan arama ve detay sekmeleri | Kısmi | M+S | KISMI |
| TRN-10 | Not oluşturma/düzenleme | Maestro | M+I | KISMI |
| TRN-11 | Not silme | API/UI var | M+I | YOK |
| TRN-12 | Grup dersi oluştur/düzenle/sil talebi | Maestro | M+I | KISMI |
| TRN-13 | Katılımcı/arama/kapasite/bekleme listesi | Kısmi görünürlük | M+I+U | YOK |
| TRN-14 | Paketler | Smoke | M+S | KISMI |
| TRN-15 | Kazanç ve komisyon hesabı | Smoke | I+U+M | KISMI |
| TRN-16 | Risk ekranı | Smoke | I+M | KISMI |
| TRN-17 | Toplu bildirim | Maestro UI | M+I+D | KISMI |
| TRN-18 | Talep merkezi sonuçları | Saat talebi listeleniyor | M+I | KISMI |
| TRN-19 | Profil, biyometri, rol ve çıkış | Çıkış kısmi | M+I+D | KISMI |

## Danışan operasyonları

| ID | Özellik | Mevcut | Gerekli | Durum |
| --- | --- | --- | --- | --- |
| MEM-01 | Ana ekran bütün hızlı işlemler | Kısmi | M | KISMI |
| MEM-02 | Paketler ve toplam kalan hak | Maestro + DB | M+I+U | KANIT_VAR |
| MEM-03 | Takvim görünümü | Smoke | M+S | KISMI |
| MEM-04 | Haftalık uygunluk kaydetme | API/UI var | M+I+U | YOK |
| MEM-05 | Randevu liste/detay | Smoke + detay | M+S | KISMI |
| MEM-06 | Randevu iptali | Maestro + DB | M+I | KANIT_VAR |
| MEM-07 | Saat değişikliğini kabul/ret | Aynı randevuda ret + yeni talep + kabul, DB ve üç takvim kanıtı | M+I | KANIT_VAR |
| MEM-08 | Grup dersine katıl/ayrıl | Maestro + DB event | M+I | KANIT_VAR |
| MEM-09 | Grup dersi bekleme listesi | API var | M+I+U | YOK |
| MEM-10 | Ölçüm oluşturma ve geçmiş | Maestro + DB | M+I+U | KANIT_VAR |
| MEM-11 | Gelişim özeti ve grafik hesapları | Smoke | U+I+M | KISMI |
| MEM-12 | Katılım geçmişi | Görünürlük | I+M | KISMI |
| MEM-13 | Kampanyalar | Gerçek veri okunuyor | M+I+U | KISMI |
| MEM-14 | Kampanya ödülünün haklara eklenmesi | Yok | I+U+M | YOK |
| MEM-15 | Referans oluşturma | Maestro + DB | M+I | KANIT_VAR |
| MEM-16 | QR tam ekran/yenileme | Ekran var | M+S | YOK |
| MEM-17 | Bildirim tercihleri 10 alan + sessiz saat | 2 alan doğrulandı | M+I+U | KISMI |
| MEM-18 | Klinikten ayrılma | Maestro + DB | M+I | KANIT_VAR |
| MEM-19 | Klinik keşfi ve detay | Maestro | M+S | KISMI |
| MEM-20 | Paket/eğitmen/gün/saat/özet başvurusu | Duo/çoklu Maestro | M+I+U | KISMI |
| MEM-21 | Ek paket başvurusu ve yönetici kararı | Parçalı edge akışı | M+I | KISMI |
| MEM-22 | Geçersiz QR/klinik ve aktif üyelik engeli | Deep-link testleri | M+I | KISMI |

## Roller arası kabul zincirleri

| ID | Zincir | Gerekli | Durum |
| --- | --- | --- | --- |
| XROLE-01 | Paket oluştur → danışan görür → başvurur → yönetici onaylar → paket aktif | M+I | YOK |
| XROLE-02 | Randevu oluştur → eğitmen görür → saat değişir → danışan onaylar | M+I+U | KANIT_VAR |
| XROLE-03 | Check-in → hak düşer → katılım ve gelir güncellenir | M+I+U | YOK |
| XROLE-04 | Grup dersi talebi → admin onayı → danışan katılımı → kapasite | M+I+U | YOK |
| XROLE-05 | Kampanya koşulu → ödül → danışan hakkı/bildirimi | M+I+U+D | YOK |
| XROLE-06 | RevenueCat purchase → entitlement → backend abonelik → read/write erişim | I+D | CIHAZ |

## Test katmanı kararı

- Salt okunur ekran ve statik metinlerde integration testi eklenmez; Maestro
  smoke veya contract kontrolü yeterlidir.
- Hesaplama içermeyen basit navigasyon için unit test eklenmez.
- Para, komisyon, hak, kapasite, tarih/saat ve kampanya kuralı için unit test
  gerekir.
- Veri değiştiren, rol/yetki veya transaction içeren endpoint için gerçek
  PostgreSQL integration gerekir.
- Her kullanıcı yolculuğu için Maestro gerekir; aynı iş kuralı her UI
  varyantında yeniden unit test edilmez.
- RevenueCat, push, biyometri, kamera ve native paylaşım fiziksel cihaz
  sonucuyla kapatılır.

## İlk uygulama paketi

1. `AUTH-14`–`AUTH-16`: butonsuz biyometri, başarısız/iptal/token geçersiz
   durumunda şifre fallback'i.
2. `AUTH-07`–`AUTH-13`: kayıt, davet, legal consent, çıkış, rol ve bildirim
   izinleri.
3. `AUTH-17`: gerçek şifre sıfırlama backend ve mobil akışı.
4. `ACT-01`–`ACT-08`: aktivasyon happy-path ve hata/idempotency zinciri.
5. `SUB-01`–`SUB-08`: trial, paywall, webhook, restore ve lifecycle.
6. Paket sonunda tekil Maestro + API/DB kanıtı, ardından auth/activation/
   subscription regresyonu.
