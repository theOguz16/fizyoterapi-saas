// Bu layout trainer akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRoleLayoutRoutes } from "@/lib/navigation";
import { createRoleTabOptions } from "@/theme/components/tab-bar-options";

const routes = getRoleLayoutRoutes("TRAINER");

export default function TrainerLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        ...createRoleTabOptions({
          role: "TRAINER",
          routeName: route.name,
          width,
          bottomInset: insets.bottom,
        }),
      })}
    >
      {routes.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={route.visibility === "tab" ? { title: route.title || undefined } : { href: null }}
        />
      ))}
    </Tabs>
  );
}
