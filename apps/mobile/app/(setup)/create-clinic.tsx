// Bu sayfa mobil uygulamada setup akisindaki create clinic ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyCreateClinicScreen() {
  return <Redirect href="/(admin)/salon/setup" />;
}
