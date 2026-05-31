// Bu layout trainer akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createResponsiveTabOptions } from "@/theme/components/tab-bar-options";

export default function TrainerLayout() {
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
            clients: "clients",
            calendar: "calendar",
            earnings: "earnings",
            profile: "profile",
          },
        }),
      })}
    >
      <Tabs.Screen name="calendar" options={{ title: "Takvim" }} />
      <Tabs.Screen name="clients" options={{ title: "Danışanlar" }} />
      <Tabs.Screen name="home" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="earnings" options={{ title: "Kazanç" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      <Tabs.Screen name="today" options={{ href: null }} />
      <Tabs.Screen name="packages" options={{ href: null }} />
      <Tabs.Screen name="qr" options={{ href: null }} />
      <Tabs.Screen name="bookings" options={{ href: null }} />
      <Tabs.Screen name="checkin" options={{ href: null }} />
      <Tabs.Screen name="members" options={{ href: null }} />
      <Tabs.Screen name="members/[id]" options={{ href: null }} />
      <Tabs.Screen name="risk" options={{ href: null }} />
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="note-edit" options={{ href: null }} />
      <Tabs.Screen name="group-classes" options={{ href: null }} />
    </Tabs>
  );
}
