import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../tokens";

type Props = {
  children: ReactNode;
  testID?: string;
};

export function StickyActionBar({ children, testID }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, tokens.spacing.sm),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingTop: tokens.spacing.sm,
  },
});
