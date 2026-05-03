// Bu sayfa mobil uygulamada owner-setup akisindaki clinic ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyOwnerClinicScreen() {
  return <Redirect href="/(admin)/salon/setup" />;
}
