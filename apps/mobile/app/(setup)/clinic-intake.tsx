// Bu sayfa mobil uygulamada setup akisindaki clinic intake ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyClinicIntakeScreen() {
  return <Redirect href="/(admin)/salon/setup" />;
}
