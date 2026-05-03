// Bu layout member akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createResponsiveTabOptions } from "@/theme/components/tab-bar-options";

// Uye tarafinin alt tab navigasyonu burada toplanir.
// Hangi ekranlar tab'de gorunsun, hangileri sadece push ile acilsin sorusu bu dosyada cozulur.
export default function MemberLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        ...createResponsiveTabOptions({
          routeName: route.name,
          width,
          bottomInset: insets.bottom,
          featuredRoutes: ["home"],
          iconMap: {
            home: "home",
            calendar: "calendar",
            package: "package",
            measurements: "measurements",
            profile: "profile",
          },
        }),
      })}
    >
      {/* Ana kullanici rotalari */}
      <Tabs.Screen name="calendar" options={{ title: "Takvim" }} />
      <Tabs.Screen name="package" options={{ title: "Paketim" }} />
      <Tabs.Screen name="home" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="measurements" options={{ title: "Ölçümler" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      {/* Ayrinti ekranlari tab listesinde gorunmez; ilgili ana sayfadan push edilir. */}
      <Tabs.Screen name="bookings" options={{ href: null }} />
      <Tabs.Screen name="group-classes" options={{ href: null }} />
      <Tabs.Screen name="plan" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="booking/[id]" options={{ href: null }} />
      <Tabs.Screen name="measurement/[id]" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="qr/fullscreen" options={{ href: null }} />
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}
