import { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../tokens";

type Props = {
  children: ReactNode;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  bounded?: boolean;
};

export function ScrollPanel({ children, maxHeight = 320, style, contentContainerStyle, testID, bounded = false }: Props) {
  if (!bounded) {
    return (
      <View testID={testID} style={[styles.panel, styles.content, style, contentContainerStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={[styles.panel, { maxHeight }, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexGrow: 0,
  },
  content: {
    gap: tokens.spacing.sm,
    paddingRight: 2,
  },
});
