// Bu paylasilan UI component'i mobil tasarim sistemindeki tab bar options parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { Platform, View } from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";

type OptionsInput = {
  routeName: string;
  width: number;
  bottomInset: number;
  iconMap: Record<string, AppIconName>;
  featuredRoutes?: string[];
};

export function createResponsiveTabOptions({ routeName, width, bottomInset, iconMap, featuredRoutes = [] }: OptionsInput) {
  const compact = width < 390;
  const isFeatured = featuredRoutes.includes(routeName);
  const tabBarHeight = (compact ? 60 : 66) + Math.max(bottomInset, compact ? 6 : 8);

  return {
    headerShown: false,
    tabBarActiveTintColor: tokens.colors.primaryStrong,
    tabBarInactiveTintColor: tokens.colors.textMuted,
    tabBarHideOnKeyboard: true,
    tabBarShowLabel: false,
    tabBarActiveBackgroundColor: "transparent",
    tabBarStyle: {
      position: "absolute" as const,
      left: compact ? 10 : 14,
      right: compact ? 10 : 14,
      bottom: Platform.OS === "ios" ? 10 : 8,
      height: tabBarHeight,
      paddingTop: compact ? 8 : 10,
      paddingBottom: Math.max(bottomInset, compact ? 6 : 8),
      paddingHorizontal: compact ? 8 : 10,
      backgroundColor: "rgba(248,250,251,0.98)",
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: "rgba(151,187,156,0.14)",
      borderRadius: compact ? 22 : 26,
      ...tokens.shadow.float,
    },
    tabBarItemStyle: {
      minHeight: isFeatured ? (compact ? 50 : 54) : compact ? 42 : 46,
      paddingHorizontal: 0,
      borderRadius: tokens.radius.pill,
      marginHorizontal: compact ? 2 : 3,
      marginTop: 0,
    },
    tabBarIconStyle: {
      marginTop: compact ? 2 : 3,
      marginBottom: 0,
    },
    tabBarIcon: ({ focused }: { focused: boolean; color: string; size: number }) => (
      <View
        style={[
          {
            minWidth: isFeatured ? (compact ? 62 : 70) : compact ? 42 : 48,
            minHeight: isFeatured ? (compact ? 54 : 60) : compact ? 42 : 48,
            borderRadius: tokens.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: isFeatured ? 1 : 0,
            backgroundColor: isFeatured
              ? tokens.colors.primaryStrong
              : focused
                ? tokens.colors.primary
                : "transparent",
            borderWidth: isFeatured || focused ? 1 : 0,
            borderColor: isFeatured ? "rgba(255,255,255,0.18)" : focused ? "rgba(151,187,156,0.22)" : "transparent",
          },
          isFeatured ? tokens.shadow.focus : null,
        ]}
      >
        <AppIcon
          name={iconMap[routeName] || "profile"}
          active={focused || isFeatured}
          size={isFeatured ? "lg" : "md"}
          variant="plain"
          tone={focused || isFeatured ? "primary" : "neutral"}
        />
      </View>
    ),
  };
}
