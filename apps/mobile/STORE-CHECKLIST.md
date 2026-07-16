# FizyoFlow App Store Checklist

## Konumlandırma Kaynağı
- Ürün kategorisi: Fizyoterapi ve pilates klinikleri için mobil klinik yönetim platformu
- Ana müşteri: Klinik veya salon sahibi
- Ana vaat: Randevu, paket, danışan, ekip, QR ve gelir/seans takibini tek akışta yönetmek
- Destek deneyimleri: Fizyoterapist ve danışan ekranları klinik operasyonuna bağlı çalışır; ayrı hedef kitle gibi anlatılmaz

## Türkçe App Store Metinleri
- Uygulama adı: `FizyoFlow`
- Alt başlık: `Mobil Klinik Yönetimi`
- Tanıtım metni: `Fizyoterapi ve pilates kliniklerinde randevu, paket, danışan, ekip, QR ve gelir/seans takibini tek mobil yönetim akışında birleştirin.`
- Anahtar kelimeler: `klinik,fizyoterapi,pilates,randevu,seans,paket,danışan,ekip,check-in,gelir,takvim,QR`

### Açıklama
FizyoFlow, fizyoterapi ve klinik pilates merkezleri için geliştirilmiş mobil öncelikli klinik yönetim platformudur.

Klinik sahibi randevu, seans, paket, danışan, ekip ve gelir süreçlerini tek merkezden yönetir. Fizyoterapistler günlük programlarını ve danışan bilgilerini kendi ekranlarından takip eder; danışanlar yaklaşan seanslarını, kalan haklarını ve geçmiş kayıtlarını mobilde görür.

FizyoFlow ile:
- Randevu, bireysel seans ve grup dersi takvimini yönetin.
- Paketleri, kalan hakları ve yenileme ihtiyacını takip edin.
- Danışan kayıtlarını ve ekip atamalarını düzenli tutun.
- QR veya kod ile check-in işlemini doğru paketle ilişkilendirin.
- Gelir ve seans görünümünü tek yönetim merkezinden izleyin.
- Fizyoterapist ve danışan deneyimini kliniğinizin güncel operasyonuna bağlayın.

Dağınık mesajlar ve tablolar yerine kliniğinizin günlük işlerini tek mobil akışta tutun.

## Ekran Görüntüsü Hikayesi
1. Klinik yönetimi: randevu, paket, danışan, ekip ve gelir/seans özeti
2. Paket ve hizmet yönetimi
3. Randevu ve seans takvimi
4. Danışan ve ekip takibi
5. Klinik operasyonuna bağlı QR check-in
6. Klinik operasyonuna bağlı danışan deneyimi

Kaynak dosya: `appstore-screenshots/render-appstore-shots.mjs`
Çıktı klasörü: `appstore-screenshots/final`

## Zorunlu Hazırlık
- Uygulama gizlilik metni ve KVKK/aydınlatma linkleri
- Push izin açıklamaları (iOS/Android)
- Hesap silme ve destek iletişim linkleri
- TestFlight build üzerinde fiziksel iPhone push matrisi: admin/trainer/member token kaydı, izin reddi, foreground/background/terminated teslimat ve hedef ekran
- Her push senaryosu için Maestro logu, ekran görüntüsü, Expo ticket ve Expo/APNs receipt kaydı

## Build Profilleri
- development: internal testing
- preview: closed beta
- production: store release

## Rollout
1. Internal test (10-20 kullanıcı)
2. Closed beta
3. Production: %10 -> %50 -> %100

Store gönderiminden önce `PUSH_RELEASE_EVIDENCE` ve aynı build numarasını taşıyan `PUSH_RELEASE_BUILD` ile `pnpm release:push:mobile` başarılı olmalıdır. Simülatör çıktısı veya önceki build kanıtı kabul edilmez.
