import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { captureMobileException } from "@/lib/sentry";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureMobileException(error, {
      componentStack: info.componentStack,
    });
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <AppIcon name="risk" size="lg" tone="danger" />
        </View>
        <Text style={styles.title}>Ekran toparlanamadı</Text>
        <Text style={styles.copy}>Beklenmeyen bir hata oluştu. Tekrar denediğinde ekranı yeniden yükleyeceğiz.</Text>
        <ActionButton label="Tekrar dene" icon="spark" onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.background,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
    textAlign: "center",
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    textAlign: "center",
  },
});
