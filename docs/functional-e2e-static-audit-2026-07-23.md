# Fonksiyonel Maestro statik denetimi — 23 Temmuz 2026

Bu denetim Maestro koşusundan **önce** yapılmıştır. “Revize edildi” ifadesi,
YAML/fixture/verifier kodunun hazırlandığını anlatır; cihazda başarılı koşu
kanıtı değildir.

## 22 fonksiyonel aday

| Akış | Statik eksik | Yapılan revizyon | Koşu sonrası zorunlu kanıt |
| --- | --- | --- | --- |
| Yönetici başvuru onayı | Temiz seed’de onaylanacak başvuru yoktu; yalnız listeye dönüş görülüyordu | Deterministik başvuru fixture’ı, satırın kaybolma assertion’ı ve DB verifier eklendi | `salon_applications.status=APPROVED` |
| Kampanya + bildirim | Bildirim sonucu assertion’ı ve DB kanıtı yoktu | Başarı metni, kampanya/delivery verifier’ı eklendi | Kampanya pasif; template event ve SENT delivery mevcut |
| Yönetici manuel giriş | Yalnız başarı kartı görülüyordu | Attendance verifier eklendi | `attendance.manual_code=MEM-DEMO001` |
| Grup dersi yönetici onayı | Yerel reset ve kuyruktan çıkış kanıtı eksikti | Reset, satırın kaybolması ve DB verifier eklendi | Seans `SCHEDULED`, event `PROCESSED` |
| Paket CRUD | Dosya adına rağmen silme/arşivleme yapılmıyordu | Silme onayı, UI’dan kaybolma ve dört audit adımı eklendi | Paket görünmez/pasif; dört audit tipi mevcut |
| Salon profili + çalışma saatleri | Kaydetme sonrası sonuç ve DB kanıtı eksikti | İki başarı assertion’ı ve profile/business-hours verifier eklendi | Başlık güncel; 7. gün çalışma günlerinde |
| Klinik aktivasyonu 1/4–4/4 | Flow kendi başına state/keychain/reset izolasyonu kurmuyordu | İzole başlangıç eklendi | Mevcut API verifier: klinik, paket, saatler, QR, abonelik |
| Duo paket başvurusu | UI sonucu vardı, başvuru/partner/slot DB kanıtı yoktu | DB verifier eklendi | Duo event, partner bilgisi, en az üç slot ve pending application |
| Danışan giriş/routing | UI routing vardı, backend oturum audit’i ayrı değildi | Audit verifier eklendi | Son `AUTH_LOGIN` başarılı ve rol MEMBER |
| Klinik bağlantısı | Kalıcı iş sonucu üretmeyen QR doğrulama ve yönlendirme adımları tek başlıkta karışıktı | Reset izolasyonu eklendi; bu akış DB mutation sayılmayacak | Geçersiz QR mesajı, paket ekranı, klinik değiştirme ve bağlantı iptali UI kanıtı |
| Danışan çekirdek işlemleri | Zaten DB verifier vardı | Reset izolasyonu eklendi | Hak, iptal, grup talebi, tercihler ve üyelikten ayrılma |
| Ölçüm oluşturma | UI geçmişi vardı, yeni ölçüm satırı DB kapısında değildi | DB verifier eklendi | Boy/kilo/not değerleri aynı measurement kaydında |
| Çoklu paket başvurusu | UI sonucu vardı, iki paket ve başvuru payload’ı kanıtlanmıyordu | DB verifier eklendi | `package_ids` ve `selected_packages` uzunluğu 2 |
| Referans oluşturma | UI listesi vardı, DB kapısı yoktu | DB verifier eklendi | INVITED referral ve iletişim bilgisi |
| Yönetici giriş/routing | UI routing vardı, backend oturum audit’i ayrı değildi | Audit verifier eklendi | Son `AUTH_LOGIN` başarılı ve rol ADMIN |
| Release sınır durumları | Ek paket, ret ve 401 tek dosyada UI ile sınırlıydı | Üç DB/audit verifier eklendi | ACTIVE_MEMBERSHIP talebi, REJECTED event ve başarısız login audit’i |
| Eğitmen giriş/routing | UI routing vardı, backend oturum audit’i ayrı değildi | Audit verifier eklendi | Son `AUTH_LOGIN` başarılı ve rol TRAINER |
| Eğitmen not + saat değişikliği | UI sonucu vardı, note/event DB kapısı yoktu | DB verifier eklendi | Güncellenmiş note history ve pending schedule-change event |
| Grup dersi create/update/delete request | Üç UI mesajı vardı, aynı zincirin DB karşılığı yoktu | Üç request türünü zorunlu kılan verifier eklendi | CREATE, UPDATE ve CANCEL eventlerinin üçü de mevcut |
| Grup dersi oluşturma | UI mesajı vardı, session/event kanıtı yoktu | DB verifier eklendi | PENDING session ve GROUP_CLASS_CREATE event |
| Eğitmen manuel check-in | Yalnız sonuç kartına kaydırılıyordu | Başarı metni ve attendance verifier eklendi | Yeni attendance kaydı |
| Eğitmen toplu bildirim + çıkış | “0 üyeye teslim” de başarılı sayılabiliyordu | Aktif test cihaz token fixture’ı, tam `1 üyeye` assertion’ı ve DB/audit verifier eklendi | TRAINER_BULK_MESSAGE event ve AUTH_LOGOUT audit’i |

## İzole fonksiyonel matris

Matris bugün 22 ürün akışına ek olarak kayıt, davet, şifre sıfırlama,
rol değiştirme, klinik aktivasyonu, randevu zinciri ve bağlantı sınır
durumlarını da içerdiği için toplam **31 bağımsız flow** çalıştırır.

Fonksiyonel runner yalnız bu sırayla çalışır:

1. Ayrı `fizyoflow_e2e` PostgreSQL verisini temizle ve seed et.
2. Akışa özel fixture gerekiyorsa oluştur.
3. iOS uygulama state/keychain temizliği ve Metro bağlantısını hazırla.
4. Maestro akışını çalıştır.
5. Akış başarılıysa ilgili API/DB verifier’ını çalıştır.
6. Bir akış başarısız olsa bile sonraki izole akışa geç ve finalde non-zero dön.

### Düzeltilen runner hatası

Hem release hem izole fonksiyonel runner, matris dosyasını `while read` ile
stdin üzerinden okuyordu. Döngü içindeki Maestro/Docker/setup/verifier
işlemleri aynı stdin'i miras aldığında kalan satırları tüketebiliyor ve komut
yalnız ilk flow'u çalıştırıp matrisi tamamlanmış gibi sonlandırabiliyordu.
Alt süreçlerin stdin'i `/dev/null` ile ayrıldı. Düzeltmeden sonra release syntax
kapısı ilk kez matrisin tamamını dolaşıp **36/36** sonucu üretti.

Runner ayrıca her flow öncesinde Docker image’larını yeniden build ediyordu.
Güncel düzen image’ları matris başında bir kez build eder; flow aralarında
`E2E_SKIP_BUILD=1` ile yalnız reset/seed çalışır. Yerel kontrolde ilk image
build’i yaklaşık üç dakika sürerken sonraki temiz reset/seed yaklaşık iki
saniyede tamamlandı.

Statik matris kapısı aşağıdakileri zorunlu tutar:

- Flow/verifier/setup dosyaları mevcut olmalı.
- Her flow `clearState`, `clearKeychain` ve `e2e-reset` içermeli.
- Kritik flow’larda `optional: true` bulunmamalı.
- Matris satır formatı bozuk olmamalı.

Komut:

```sh
pnpm --filter @fitnes-saas/mobile test:e2e:functional:validate
```

## 22 akışın dışında, tam release için ayrı kod/cihaz paketi

Aşağıdakiler 22 fonksiyonel adayın içine karıştırılmayacak:

- Push foreground/background/terminated ve izin reddi: fiziksel cihaz paketi.
- Kamera QR, fotoğrafa kaydetme, native paylaşım ve biyometri: fiziksel cihaz
  matrisi; simulator sonucu gerçek cihaz sonucu sayılmaz.
- RevenueCat: önceki başarılı sandbox/canlı satın alma kanıtı korunur; restore,
  billing issue ve expiry API/DB zinciri ayrıca raporlanır.
- Android ve ikinci iOS ekran boyutu: aynı kritik matrisin ayrı platform koşusu.
- Offline/online: gerçek ürün ekranında bağlantı kaybı/toparlanma koşusu.
- Yavaş API, timeout, 4xx/5xx ve çift tıklama: temsilî Maestro fault-injection
  akışları ve bütün kritik controller/formlar için API integration testleri.

Son grupta her formu her HTTP hatasıyla Maestro’da çoğaltmak bakım maliyeti ve
yanlış güven üretir. Doğru dağılım: gerçek kullanıcıya görünen hata/fallback
Maestro’da; tüm endpoint ve durum kombinasyonları integration testlerinde.
