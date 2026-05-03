// Bu sayfa mobil uygulamada setup akisindaki city ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyCityScreen() {
  return <Redirect href="/(intake-member)/salons" />;
}
