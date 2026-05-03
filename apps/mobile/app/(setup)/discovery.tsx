// Bu sayfa mobil uygulamada setup akisindaki discovery ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyDiscoveryScreen() {
  return <Redirect href="/(intake-member)" />;
}
