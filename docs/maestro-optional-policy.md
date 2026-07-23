# Maestro koşullu adım politikası

Fonksiyonel kullanıcı akışlarında uygulama içi butonlar, form alanları ve
işlem sonuçları `optional: true` kullanamaz. Bulunamayan kritik öğe veya
görünmeyen sonuç testi başarısız kılar.

`optional: true` yalnız aşağıdaki değişken yüzeylerde kalabilir:

- iOS'un deep-link sonrasında gösterebildiği sistem **Aç/Open** penceresi;
- aynı sistem penceresinin cihaz/işletim sistemi sürümüne göre görünmeyen
  yardımcı açıklaması;
- pazarlama ekran görüntüsü akışında, görüntülenmesi zorunlu olmayan ek
  detay kartı.

Bu istisnalar yalnız `release-edge-cases.yaml`,
`mobile-back-navigation-smoke.yaml`, ilgili salon QR deep-link dosyaları ve
`marketing-trainer-screenshots.yaml` içinde bulunur. Fonksiyonel E2E sonucu
hesaplanırken bu dosyalar zaten ayrı sınıfta raporlanır.
