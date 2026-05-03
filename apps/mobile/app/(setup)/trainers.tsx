// Bu sayfa mobil uygulamada setup akisindaki trainers ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyTrainersScreen() {
  return <Redirect href="/(intake-member)/booking-summary" />;
}
