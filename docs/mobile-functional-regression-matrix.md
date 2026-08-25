# Mobil Fonksiyonel Regresyon Matrisi

Bu matris, release kapısında **fonksiyonel** kabul edilen Maestro akışlarını
ekran, kullanıcı işlemi ve doğrulanan sonuç açısından görünür kılar. Deep-link,
görünürlük ve pazarlama ekran görüntüsü dosyaları bu tabloya dahil değildir.

| Akış | Ekran / özellik | Kullanıcı işlemi | Sonuç doğrulaması |
| --- | --- | --- | --- |
| `auth-owner-registration-functional.yaml` | Klinik sahibi kaydı ve yasal onay | Eksik/onaysız form reddedilir, hesap oluşturulur | Hesap, consent ve login DB/API ile doğrulanır |
| `auth-member-registration-functional.yaml` | Klinik bağlantılı danışan kaydı | Eksik/onaysız form reddedilir, gerçek kayıt gönderilir | Salon detayına geçiş; hesap, consent ve login DB/API ile doğrulanır |
| `auth-trainer-invite-functional.yaml` | Eğitmen daveti | Gerçek admin davet kodu girilir, yasal onayla kabul edilir ve login olunur | Eğitmen ana ekranı; invite/user/consent/login DB/API ile doğrulanır |
| `auth-password-reset-request-functional.yaml` | Şifre sıfırlama isteği | Geçersiz ve geçerli e-posta gönderilir | Eski token tüketilir, tek aktif token DB'de doğrulanır |
| `auth-password-reset-confirm-functional.yaml` | Yeni şifre belirleme | Token ve yeni şifre gönderilir, yeni şifreyle login olunur | Token tüketimi, auth version, eski/yeni login API ile doğrulanır |
| `auth-role-switch-logout-functional.yaml` | Rol değiştirme ve çıkış | Yönetici login, eğitmene geçiş, profil çıkışı | Aktif trainer context ve `AUTH_LOGOUT` audit DB'de doğrulanır |
| `clinic-owner-activation-flow.yaml` | Klinik aktivasyonu 1/4–4/4 | Klinik bilgisi, gerçek paket kataloğu ve çalışma günleri kaydedilir | Klinik/paket/saat/QR/subscription API+DB ile ve plan ekranında doğrulanır |
| `appointment-calendar-cross-role-functional.yaml` | Üç rollü randevu ve takvim zinciri | Yönetici randevu oluşturur; eğitmen görür ve iki saat önerisi yollar; danışan birini reddedip diğerini onaylar | Üç rol takvimi, Booking/NotificationEvent kayıtları, geçmiş saat, çakışma, kapasite, çift gönderim ve idempotent iptal gerçek API/PostgreSQL ile doğrulanır |
| `admin-package-crud-functional.yaml` | Yönetici paket yönetimi | Paket oluşturulur, güncellenir, pasifleştirilir ve arşivlenir | UI sonucu ve API/DB verifier |
| `login-role-routing.yaml` | Giriş ve rol yönlendirmesi | Danışan giriş formu gönderilir | Danışan ana ekranına geçilir |
| `member-measurement-functional.yaml` | Danışan ölçüm kaydı | Ölçüm alanları doldurulup kaydedilir | Geçmiş ve DB kaydı |
| `release-admin-login.yaml` | Yönetici girişi | Giriş formu gönderilir | Yönetici dashboard'u görünür |
| `release-trainer-login.yaml` | Eğitmen girişi | Giriş formu gönderilir | Eğitmen ana ekranı görünür |
| `trainer-group-classes-functional.yaml` | Eğitmen grup dersi | Oluşturma, güncelleme ve silme talebi gönderilir | Üç event DB’de doğrulanır |
| `trainer-group-class-create-functional.yaml` | Eğitmen grup dersi listesi | Ders oluşturulup gönderilir | Pending session ve onay eventi |
| `trainer-manual-checkin-functional.yaml` | Eğitmen manuel check-in | MEM kodu girilip onaylanır | Başarı sonucu ve attendance kaydı |

## Çalıştırma kuralı

- Her akış `clearState`, `clearKeychain`, `e2e-reset` ve rol girişiyle temiz
  başlangıç yapar.
- Her çalıştırmadan önce izole PostgreSQL fixture'ı yeniden kurulur.
- Başarı yalnızca tüm komutlar `COMPLETED` olduğunda kaydedilir; `SKIPPED`
  sistem penceresi yardımcı adımlarıyla sınırlı kalır.
- iOS sürücü/Metro erişim hataları ürün hatası olarak sayılmaz, ancak release
  raporunda ayrı bir çevre bulgusu olarak mutlaka belirtilir.
