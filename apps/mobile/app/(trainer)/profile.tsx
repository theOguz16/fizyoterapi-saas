import { useMemo } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/providers/auth-session";
import { RoleSwitchActions } from "@/components/role-switch-actions";
import { getTrainerAssignedPackagesApi, type TrainerAssignedPackage } from "@/lib/mobile-api";
import { packageTypeLabel } from "@/lib/labels";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { buildRoleActionHref, getRoleAction } from "@/lib/role-actions";

export default function TrainerProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, availablePersonas, membershipStatus, logout } = useSession();
  const { data: assignedPackages = [], isLoading } = useQuery({
    queryKey: ["trainer-assigned-packages"],
    queryFn: getTrainerAssignedPackagesApi,
  });
  const lessonChips = useMemo(() => buildTrainerLessonChips(assignedPackages), [assignedPackages]);
  const packagesAction = getRoleAction("TRAINER_PACKAGES");
  const qrAction = getRoleAction("TRAINER_QR");
  const accountSettingsAction = getRoleAction("SHARED_ACCOUNT_SETTINGS");

  const personaLabel = useMemo(() => {
    const labels = (availablePersonas || []).map((role) => {
      if (role === "MEMBER") return "Üye";
      if (role === "ADMIN") return "Yönetici";
      return "Eğitmen";
    });
    return labels.length > 0 ? labels.join(" • ") : "Eğitmen";
  }, [availablePersonas]);

  return (
    <AppShell testID="trainer-profile-screen" title="Profil" subtitle="Uzmanlıkların, hesap bilgilerin ve eğitmen hesabına ait hızlı işlemler burada yer alır." icon="trainer">
      <SurfaceCard tone="primary">
        <Text style={styles.name}>{user?.fullName || "Eğitmen"}</Text>
        <Text style={styles.copy}>{user?.email || "E-posta eklenmemiş"}</Text>
        {user?.phone ? <Text style={styles.copy}>{user.phone}</Text> : null}
        <View style={styles.row}>
          <StatusBadge label="Eğitmen" tone="info" />
          <StatusBadge label={activeMembership?.tenant_name || "Salon bağlantısı bekleniyor"} tone="premium" />
        </View>
      </SurfaceCard>

      <View style={styles.metricsRow}>
        <MetricCard label="Rol" value="Eğitmen" hint={personaLabel} icon="trainer" />
        <MetricCard label="Salon" value={activeMembership?.tenant_name || "-"} hint={membershipStatus || "Bağlantı durumu"} icon="salon" />
      </View>

      <SurfaceCard>
        <Text style={styles.section}>Verdiği dersler</Text>
        {isLoading ? (
          <Text style={styles.copy}>Trainer dersleri hazırlanıyor...</Text>
        ) : lessonChips.length > 0 ? (
          <View style={styles.skillsRow} testID="trainer-profile-assigned-lessons">
            {lessonChips.map((lesson) => (
              <StatusBadge key={lesson} label={lesson} tone="info" />
            ))}
          </View>
        ) : (
          <Text style={styles.copy}>Henüz bu eğitmene atanmış ders görünmüyor. Admin paket tanımını trainera bağladığında PT, grup dersi veya ilgili ders adı burada mavi kutucuklarla listelenecek.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Çalışma bilgilerim</Text>
        <Text style={styles.copy}>Sana atanmış paketleri ve eğitmen QR kodunu buradan görüntüle.</Text>
        <ActionButton testID="trainer-profile-packages" label={packagesAction.label} icon={packagesAction.icon} onPress={() => router.push(buildRoleActionHref("TRAINER_PACKAGES", "/(trainer)/profile") as never)} />
        <ActionButton testID="trainer-profile-qr" label={qrAction.label} icon={qrAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("TRAINER_QR", "/(trainer)/profile") as never)} />
      </SurfaceCard>

      <RoleSwitchActions />

      <SurfaceCard>
        <Text style={styles.section}>Hesap ayarları</Text>
        <Text style={styles.copy}>{accountSettingsAction.description}</Text>
        <ActionButton testID="trainer-profile-account-settings" label={accountSettingsAction.label} icon={accountSettingsAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("SHARED_ACCOUNT_SETTINGS", "/(trainer)/profile") as never)} />
      </SurfaceCard>

      <ActionButton testID="trainer-profile-logout" label="Çıkış yap" icon="logout" variant="ghost" onPress={() => void logout()} />
    </AppShell>
  );
}

function buildTrainerLessonChips(packages: TrainerAssignedPackage[]) {
  const labels = packages
    .filter((item) => item && item.id)
    .map((item) => {
      const serviceName = String(item.service_name || item.lesson_category_label || item.title || item.package_name || "").trim();
      const typeLabel = packageTypeLabel(item.package_type);
      if (serviceName && typeLabel !== "-") return `${serviceName} • ${typeLabel}`;
      return serviceName || typeLabel;
    })
    .filter((label) => label && label !== "-");

  return Array.from(new Set(labels));
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  name: {
    color: tokens.colors.text,
    fontSize: tokens.font.xxl,
    fontFamily: tokens.fontFamily.bold,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
});
