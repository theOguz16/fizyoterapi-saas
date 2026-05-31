import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";

export default function E2ELoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string | string[];
    password?: string | string[];
    redirect?: string | string[];
    skipAuth?: string | string[];
    role?: string | string[];
  }>();
  const { login } = useSession();
  const [error, setError] = useState("");

  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const password = Array.isArray(params.password) ? params.password[0] : params.password;
  const redirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const skipAuth = Array.isArray(params.skipAuth) ? params.skipAuth[0] : params.skipAuth;
  const role = normalizeRole(params.role);

  useEffect(() => {
    if (!__DEV__) return;
    if (skipAuth === "1") {
      router.replace((redirect || "/(auth)/welcome") as never);
      return;
    }

    if (!email || !password) return;

    void (async () => {
      try {
        await login({ email, password, role, e2e: true });
        router.replace((redirect || "/(auth)/welcome") as never);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "E2E login başarısız.");
      }
    })();
  }, [email, login, password, redirect, role, router, skipAuth]);

  if (!__DEV__) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator size="large" color={tokens.colors.primary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.lg,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
    textAlign: "center",
  },
});

function normalizeRole(value: string | string[] | undefined) {
  const role = String(Array.isArray(value) ? value[0] : value || "").toUpperCase();
  if (role === "ADMIN" || role === "TRAINER" || role === "MEMBER") return role;
  return undefined;
}
