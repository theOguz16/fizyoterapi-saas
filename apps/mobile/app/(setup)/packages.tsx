// Bu sayfa mobil uygulamada setup akisindaki packages ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyPackagesScreen() {
  return <Redirect href="/(intake-member)/packages" />;
}
