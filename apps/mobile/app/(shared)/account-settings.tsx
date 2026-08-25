import { useLocalSearchParams, useRouter } from "expo-router";
import { getProfileRouteForRole } from "@/lib/account-settings";
import { getRoleAction } from "@/lib/role-actions";
import { useSession } from "@/providers/auth-session";
import { AppShell } from "@/theme/components/app-shell";
import { SettingsNavigationRow } from "@/theme/components/settings-navigation-row";
import { SurfaceCard } from "@/theme/components/surface-card";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const { user } = useSession();
  const profileBackTo = firstParam(params.backTo) || getProfileRouteForRole(user?.role);
  const notificationAction = getRoleAction("SHARED_NOTIFICATION_SETTINGS");
  const securityAction = getRoleAction("SHARED_SECURITY_SETTINGS");
  const accountActions = getRoleAction("SHARED_ACCOUNT_ACTIONS");

  function openChild(pathname: string) {
    router.push({
      pathname,
      params: {
        backTo: "/(shared)/account-settings",
        profileBackTo,
      },
    } as never);
  }

  return (
    <AppShell
      testID="account-settings-screen"
      title="Hesap ayarları"
      subtitle="Bildirim, güvenlik ve hesap işlemlerini tek merkezden yönet."
      icon="settings"
      onBack={() => router.replace(profileBackTo as never)}
    >
      <SurfaceCard>
        <SettingsNavigationRow
          testID="account-settings-notifications"
          title={notificationAction.label}
          description={notificationAction.description}
          icon={notificationAction.icon}
          onPress={() => openChild(notificationAction.route)}
        />
        <SettingsNavigationRow
          testID="account-settings-security"
          title={securityAction.label}
          description={securityAction.description}
          icon={securityAction.icon}
          onPress={() => openChild(securityAction.route)}
        />
        <SettingsNavigationRow
          testID="account-settings-account-actions"
          title={accountActions.label}
          description={accountActions.description}
          icon={accountActions.icon}
          onPress={() => openChild(accountActions.route)}
        />
      </SurfaceCard>
    </AppShell>
  );
}
