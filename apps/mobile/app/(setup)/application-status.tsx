// Bu sayfa mobil uygulamada setup akisindaki application status ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyApplicationStatusScreen() {
  return <Redirect href="/(intake-member)/approval-pending" />;
}
