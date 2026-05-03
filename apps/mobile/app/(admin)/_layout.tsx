// Bu layout admin akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createResponsiveTabOptions } from "@/theme/components/tab-bar-options";

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        ...createResponsiveTabOptions({
          routeName: route.name,
          width,
          bottomInset: insets.bottom,
          featuredRoutes: ["dashboard"],
          iconMap: {
            dashboard: "dashboard",
            calendar: "calendar",
            approvals: "approvals",
            members: "members",
            profile: "profile",
          },
        }),
      })}
    >
      <Tabs.Screen name="calendar" options={{ title: "Takvim" }} />
      <Tabs.Screen name="approvals" options={{ title: "Onaylar" }} />
      <Tabs.Screen name="dashboard" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="members" options={{ title: "Üyeler" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      <Tabs.Screen name="salon" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="entry-scan" options={{ href: null }} />
      <Tabs.Screen name="members/[id]" options={{ href: null }} />
      <Tabs.Screen name="dashboard/risk-preview" options={{ href: null }} />
      <Tabs.Screen name="dashboard/revenue-detail" options={{ href: null }} />
      <Tabs.Screen name="approval/[id]" options={{ href: null }} />
      <Tabs.Screen name="risk-members" options={{ href: null }} />
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="campaigns/new" options={{ href: null }} />
      <Tabs.Screen name="working-hours" options={{ href: null }} />
      <Tabs.Screen name="pricing" options={{ href: null }} />
      <Tabs.Screen name="packages" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="salon-profile" options={{ href: null }} />
      <Tabs.Screen name="clinic-qr" options={{ href: null }} />
      <Tabs.Screen name="salon/setup" options={{ href: null }} />
      <Tabs.Screen name="campaign-create" options={{ href: null }} />
    </Tabs>
  );
}
