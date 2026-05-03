// Bu ekran setup akisinin giris sayfasidir.
// Kullanici bu modula geldiginde ilk karar veya ozet deneyimi bu dosyada baslar.
import { Redirect } from "expo-router";

export default function LegacySetupIndexScreen() {
  return <Redirect href="/(intake-member)" />;
}
