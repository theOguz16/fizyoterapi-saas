import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/providers/auth-session";
import type { SessionRole } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const ROLE_LABELS: Record<SessionRole, string> = {
  ADMIN: "Yönetici",
  TRAINER: "Eğitmen",
  MEMBER: "Üye",
};

const ROLE_ICONS: Record<SessionRole, "dashboard" | "trainer" | "profile"> = {
  ADMIN: "dashboard",
  TRAINER: "trainer",
  MEMBER: "profile",
};

export function RoleSwitchActions() {
  const router = useRouter();
  const { user, availablePersonas, switchRole } = useSession();
  const [pendingRole, setPendingRole] = useState<SessionRole | null>(null);
  const currentRole = user?.role as SessionRole | undefined;
  const switchableRoles = Array.from(new Set(availablePersonas || [])).filter((role) => role !== currentRole);

  if (!currentRole || switchableRoles.length === 0) {
    return null;
  }

  async function handleSwitch(role: SessionRole) {
    try {
      setPendingRole(role);
      await switchRole(role);
      router.replace("/" as never);
    } catch (error) {
      Alert.alert("Rol değiştirilemedi", error instanceof Error ? error.message : "Lütfen tekrar dene.");
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <SurfaceCard>
      <Text style={styles.section}>Rol değiştir</Text>
      <Text style={styles.copy}>Bu hesapta tanımlı diğer çalışma alanına çıkış yapmadan geçebilirsin.</Text>
      <View style={styles.actions}>
        {switchableRoles.map((role) => (
          <ActionButton
            key={role}
            label={`${ROLE_LABELS[role]} olarak geç`}
            icon={ROLE_ICONS[role]}
            variant="ghost"
            loading={pendingRole === role}
            onPress={() => void handleSwitch(role)}
          />
        ))}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm,
  },
  actions: {
    gap: tokens.spacing.xs,
  },
});
