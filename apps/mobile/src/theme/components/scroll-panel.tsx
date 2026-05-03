import { ReactNode } from "react";
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../tokens";

type Props = {
  children: ReactNode;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScrollPanel({ children, maxHeight = 320, style, contentContainerStyle, testID }: Props) {
  return (
    <ScrollView
      testID={testID}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={[styles.panel, { maxHeight }, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
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
