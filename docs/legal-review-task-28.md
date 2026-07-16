# Task 28 Hukuki İnceleme Paketi

Durum: **Yayın öncesi KVKK alanında çalışan bir hukukçu tarafından onaylanmalıdır.**

Bu belge, “hukuki metinler hukukçu onayına gönderilir” kabul kriterinin teknik karşılığıdır. Ürün ve yazılım tarafında veri akışı ile kullanıcı metinleri eşleştirildi; aşağıdaki hukuki kararlar yazılım ekibi tarafından kesinleştirilmemelidir.

## İncelenecek dosyalar

- `apps/web/app/kvkk/page.tsx`
- `apps/web/app/gizlilik-politikasi/page.tsx`
- `apps/web/app/kullanim-sartlari/page.tsx`
- `apps/mobile/src/theme/components/legal-consent-group.tsx`

## Hukukçu teyit listesi

1. Oğuz Han UYAR ile kliniklerin her veri akışındaki veri sorumlusu/veri işleyen rolleri.
2. Hesap, randevu, paket, ölçüm ve seans notları için ayrı işleme amaçları ve KVKK madde 5/6 kapsamındaki hukuki sebepler.
3. Sağlık verilerinde uygulanacak özel nitelikli veri işleme şartı, erişim sınırı ve ek teknik/idari tedbirler.
4. Bildirim, analitik, barındırma, hata izleme, ödeme ve uygulama mağazası sağlayıcılarının güncel unvanları, ülkeleri ve yurt dışı aktarım mekanizmaları.
5. Her veri kategorisi için kesin saklama ve imha süreleri; kliniklerin sağlık kaydı saklama yükümlülükleri.
6. Pazarlama iletileri için KVKK yanında 6563 sayılı Kanun ve İYS yükümlülükleri.
7. 13-18 yaş arası kullanıcı, veli/vasi ve çocuk verisi akışının ürün kapsamına uygunluğu.
8. Veri sahibi başvuru kanalı, veri sorumlusu iletişim/adres bilgileri ve gerekiyorsa VERBİS metinleri.

## Teknik kanıt

- Kayıt ekranındaki tüm seçimler varsayılan olarak kapalıdır.
- Kullanım Şartları kabulü ve aydınlatma metninin okunduğu beyanı zorunlu, ayrı kaydedilir.
- Pazarlama tercihi isteğe bağlıdır ve hesap açmayı engellemez.
- Kayıt kanıtı belge sürümü, zaman, kaynak ve pazarlama tercihiyle `accounts.legal_consents` alanında tutulur.
- Klinik bağlantısı olmayan keşif akışında belirti, tanı, gebelik, pediatrik durum veya sağlık geçmişi sorulmaz.

## Dayanak Kontrolü

- KVKK Kurulu 18.02.2026 tarihli 2026/347 sayılı ilke kararı: aydınlatma ve açık rıza ayrı düzenlenmelidir.
- Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ.
- KVKK özel nitelikli kişisel veriler rehberi ve sağlık hizmetinde pazarlama rızasının hizmet şartına dönüştürülemeyeceğine ilişkin Kurul kararları.

Onaylayan hukukçu, tarih, metin sürümü ve gerekli revizyonlar bu dosyanın altına release kaydı olarak eklenmelidir.
