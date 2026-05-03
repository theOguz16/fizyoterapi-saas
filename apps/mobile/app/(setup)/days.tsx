// Bu sayfa mobil uygulamada setup akisindaki days ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyDaysScreen() {
  return <Redirect href="/(intake-member)/time-selection" />;
}
