// Bu sayfa mobil uygulamada setup akisindaki salons ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacySalonsScreen() {
  return <Redirect href="/(intake-member)/salons" />;
}
