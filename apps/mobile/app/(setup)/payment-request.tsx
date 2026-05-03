// Bu sayfa mobil uygulamada setup akisindaki payment request ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyPaymentRequestScreen() {
  return <Redirect href="/(intake-member)/booking-summary" />;
}
