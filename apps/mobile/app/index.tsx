// Bu ekran genel akisinin giris sayfasidir.
// Kullanici bu modula geldiginde ilk karar veya ozet deneyimi bu dosyada baslar.
import { Redirect } from "expo-router";
import { useSession } from "@/providers/auth-session";
import { resolveIndexRedirect } from "@/lib/navigation";

export default function IndexScreen() {
  const { user, onboardingState, availableSurfaces, recommendedEntrySurface } = useSession();
  return <Redirect href={resolveIndexRedirect(user, onboardingState, availableSurfaces, recommendedEntrySurface)} />;
}
