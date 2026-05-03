// Bu sayfa mobil uygulamada setup akisindaki detay ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacySalonDetailScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={`/(intake-member)/salons/${String(params.slug)}`} />;
}
