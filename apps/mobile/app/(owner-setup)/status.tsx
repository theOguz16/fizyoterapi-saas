// Bu sayfa mobil uygulamada owner-setup akisindaki status ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect } from "expo-router";

export default function LegacyOwnerStatusScreen() {
  return <Redirect href="/(admin)/salon/setup" />;
}
