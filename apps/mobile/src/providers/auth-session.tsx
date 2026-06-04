// Bu provider mobil uygulamada auth session ile ilgili ortak state veya servis erisimini merkezilestirir.
// Ekranlar arasi tekrar eden baglam ihtiyaci bu dosya uzerinden yonetilir.
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "@/lib/http-client";
import { deleteAccountApi, inviteAcceptApi, loginApi, logoutApi, meApi, registerApi, SessionEnvelope, SessionRole, SessionUser, switchRoleApi } from "@/lib/mobile-api";
import { clearPendingSalonJoinSlug, getNotificationPermissionPromptState, setNotificationPermissionPromptState } from "@/lib/local-preferences";
import { getPushPermissionStatus, registerPushDeviceIfPermitted, requestPushPermissionAndRegister, type PushPermissionStatus, unregisterPushDevice } from "@/lib/push";

const TOKEN_KEY = "fizyoflow.access_token";

type LoginInput = {
  email: string;
  password: string;
  tenantSlug?: string;
  role?: SessionRole;
  e2e?: boolean;
};

type RegisterInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  account_type?: "MEMBER" | "CLINIC_ADMIN";
  onboarding_profile?: {
    role: "MEMBER" | "TRAINER" | "ADMIN";
    primary_goal: string;
    rhythm: string;
    support_style: string;
  };
};

type InviteAcceptInput = {
  token: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  password: string;
};

type SessionContextType = {
  user: SessionUser | null;
  loading: boolean;
  token: string | null;
  onboardingState: SessionEnvelope["onboarding_state"] | null;
  membershipState: SessionEnvelope["membership_state"] | null;
  membershipStatus: string | null;
  recommendedEntrySurface: SessionEnvelope["recommended_entry_surface"] | null;
  hasActiveMembership: boolean;
  hasPendingApplication: boolean;
  hasManagedClinic: boolean;
  availablePersonas: SessionRole[];
  activeMembership: SessionEnvelope["active_membership"] | null;
  managedClinic: SessionEnvelope["managed_clinic"] | null;
  pendingApplication: SessionEnvelope["pending_application"] | null;
  pendingPaymentRequest: SessionEnvelope["pending_payment_request"] | null;
  activeChangeRequests: NonNullable<SessionEnvelope["active_change_requests"]>;
  availableMobileActions: NonNullable<SessionEnvelope["available_mobile_actions"]>;
  scanCapabilities: NonNullable<SessionEnvelope["scan_capabilities"]>;
  availableSurfaces: SessionEnvelope["available_surfaces"] | null;
  pendingPostAuthScreen: "NOTIFICATION_PERMISSION" | null;
  notificationPermissionStatus: PushPermissionStatus;
  clearPendingPostAuthScreen: () => void;
  dismissNotificationPermissionPrompt: () => Promise<void>;
  requestNotificationPermission: () => Promise<PushPermissionStatus>;
  refreshNotificationPermissionStatus: () => Promise<PushPermissionStatus>;
  login: (input: LoginInput) => Promise<void>;
  switchRole: (role: SessionRole) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  acceptInvite: (input: InviteAcceptInput) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | null>(null);

// Mobil uygulamadaki kimlik ve oturum merkezi.
// API'den gelen oturum zarfini UI'nin kolay tuketecegi state alanlarina parcaliyoruz.
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<SessionEnvelope["onboarding_state"] | null>(null);
  const [membershipState, setMembershipState] = useState<SessionEnvelope["membership_state"] | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [recommendedEntrySurface, setRecommendedEntrySurface] = useState<SessionEnvelope["recommended_entry_surface"] | null>(null);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [hasManagedClinic, setHasManagedClinic] = useState(false);
  const [availablePersonas, setAvailablePersonas] = useState<SessionRole[]>([]);
  const [activeMembership, setActiveMembership] = useState<SessionEnvelope["active_membership"] | null>(null);
  const [managedClinic, setManagedClinic] = useState<SessionEnvelope["managed_clinic"] | null>(null);
  const [pendingApplication, setPendingApplication] = useState<SessionEnvelope["pending_application"] | null>(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState<SessionEnvelope["pending_payment_request"] | null>(null);
  const [activeChangeRequests, setActiveChangeRequests] = useState<NonNullable<SessionEnvelope["active_change_requests"]>>([]);
  const [availableMobileActions, setAvailableMobileActions] = useState<NonNullable<SessionEnvelope["available_mobile_actions"]>>([]);
  const [scanCapabilities, setScanCapabilities] = useState<NonNullable<SessionEnvelope["scan_capabilities"]>>([]);
  const [availableSurfaces, setAvailableSurfaces] = useState<SessionEnvelope["available_surfaces"] | null>(null);
  const [pendingPostAuthScreen, setPendingPostAuthScreen] = useState<"NOTIFICATION_PERMISSION" | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<PushPermissionStatus>("undetermined");

  function applySessionPayload(payload: Partial<SessionEnvelope> & { user?: SessionUser | null | undefined; available_surfaces?: SessionEnvelope["available_surfaces"] | null | undefined }) {
    // Login, refresh ve bootstrap ayni session alanlarini guncelliyor.
    // Bu helper merkezi tuttugunda alan unutma riski azalir.
    const hasResolvedActiveMembership = Boolean(payload.active_membership);
    const normalizedOnboardingState = hasResolvedActiveMembership ? "ACTIVE_SALON" : payload.onboarding_state || null;
    const normalizedMembershipState = hasResolvedActiveMembership ? "ACTIVE_SALON" : payload.membership_state || payload.onboarding_state || null;
    const normalizedRecommendedEntrySurface =
      hasResolvedActiveMembership && payload.user?.role === "MEMBER"
        ? "MEMBER_HOME"
        : payload.recommended_entry_surface || null;
    setUser(payload.user || null);
    setOnboardingState(normalizedOnboardingState);
    setMembershipState(normalizedMembershipState);
    setMembershipStatus(payload.membership_status || null);
    setRecommendedEntrySurface(normalizedRecommendedEntrySurface);
    setHasActiveMembership(Boolean(payload.has_active_membership || hasResolvedActiveMembership));
    setHasPendingApplication(hasResolvedActiveMembership ? false : Boolean(payload.has_pending_application || payload.pending_application));
    setHasManagedClinic(Boolean(payload.has_managed_clinic || payload.managed_clinic));
    setAvailablePersonas(Array.isArray(payload.available_personas) ? payload.available_personas : payload.user?.role ? [payload.user.role] : []);
    setActiveMembership(payload.active_membership || null);
    setManagedClinic(payload.managed_clinic || null);
    setPendingApplication(payload.pending_application || null);
    setPendingPaymentRequest(payload.pending_payment_request || null);
    setActiveChangeRequests(Array.isArray(payload.active_change_requests) ? payload.active_change_requests : []);
    setAvailableMobileActions(Array.isArray(payload.available_mobile_actions) ? payload.available_mobile_actions : []);
    setScanCapabilities(Array.isArray(payload.scan_capabilities) ? payload.scan_capabilities : []);
    setAvailableSurfaces(payload.available_surfaces || null);
  }

  async function clearSessionState() {
    // Logout ve token invalid durumlari ayni temizlik adimini kullanir.
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setPushToken(null);
    setOnboardingState(null);
    setMembershipState(null);
    setMembershipStatus(null);
    setRecommendedEntrySurface(null);
    setHasActiveMembership(false);
    setHasPendingApplication(false);
    setHasManagedClinic(false);
    setAvailablePersonas([]);
    setActiveMembership(null);
    setManagedClinic(null);
    setPendingApplication(null);
    setPendingPaymentRequest(null);
    setActiveChangeRequests([]);
    setAvailableMobileActions([]);
    setScanCapabilities([]);
    setAvailableSurfaces(null);
    setPendingPostAuthScreen(null);
    setNotificationPermissionStatus("undetermined");

    queryClient.clear();

    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  async function syncNotificationPermission(options?: { allowPromptScreen?: boolean }) {
    const status = await getPushPermissionStatus();
    setNotificationPermissionStatus(status);

    if (status === "granted") {
      const push = await registerPushDeviceIfPermitted();
      setPushToken(push.token);
      await setNotificationPermissionPromptState({
        hasSeenPrompt: true,
        lastKnownStatus: "granted",
        updatedAt: new Date().toISOString(),
      });
      setPendingPostAuthScreen(null);
      return status;
    }

    setPushToken(null);
    const promptState = await getNotificationPermissionPromptState();
    await setNotificationPermissionPromptState({
      hasSeenPrompt: promptState.hasSeenPrompt,
      lastKnownStatus: status,
      updatedAt: new Date().toISOString(),
    });
    setPendingPostAuthScreen(options?.allowPromptScreen && !promptState.hasSeenPrompt ? "NOTIFICATION_PERMISSION" : null);
    return status;
  }

  async function syncNotificationPermissionSafely(options?: { allowPromptScreen?: boolean }) {
    try {
      return await syncNotificationPermission(options);
    } catch {
      setPushToken(null);
      return notificationPermissionStatus;
    }
  }

  async function dismissNotificationPermissionPrompt() {
    await setNotificationPermissionPromptState({
      hasSeenPrompt: true,
      lastKnownStatus: notificationPermissionStatus,
      updatedAt: new Date().toISOString(),
    });
    setPendingPostAuthScreen(null);
  }

  async function requestNotificationPermission() {
    const result = await requestPushPermissionAndRegister();
    setNotificationPermissionStatus(result.status);
    setPushToken(result.token);
    await setNotificationPermissionPromptState({
      hasSeenPrompt: true,
      lastKnownStatus: result.status,
      updatedAt: new Date().toISOString(),
    });
    setPendingPostAuthScreen(null);
    return result.status;
  }

  const refreshMe = async () => {
    const me = await meApi();
    if (me.available_surfaces?.mobile === false) {
      await clearSessionState();
      throw new Error("Bu rol mobil uygulamadan giriş yapamaz. Lütfen web paneli kullanın.");
    }
    applySessionPayload(me as any);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["member-home"] }),
      queryClient.invalidateQueries({ queryKey: ["member-my-packages-list"] }),
      queryClient.invalidateQueries({ queryKey: ["member-bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["member-bookings-calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["member-availability"] }),
      queryClient.invalidateQueries({ queryKey: ["trainer-today"] }),
      queryClient.invalidateQueries({ queryKey: ["trainer-bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-v2"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-risk-members"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-mobile-approvals"] }),
    ]);
  };

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        // Uygulama acilisinda secure storage'daki token okunur.
        // Boylece kullanici her acilista yeniden login olmak zorunda kalmaz.
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!mounted) return;

        if (!stored) {
          setAuthToken(null);
          setToken(null);
          applySessionPayload({});
          return;
        }

        setAuthToken(stored);
        setToken(stored);
        const me = await meApi();
        if (!mounted) return;
        if (me.available_surfaces?.mobile === false) {
          await clearSessionState();
          return;
        }
        applySessionPayload(me as any);
        await syncNotificationPermissionSafely();
      } catch {
        await clearSessionState();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
    // Bootstrap must run once on mount; clearSessionState is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasActiveMembership) return;
    void clearPendingSalonJoinSlug();
  }, [hasActiveMembership]);

  useEffect(() => {
    if (!token) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshMe().catch(() => null);
      }
    });

    return () => {
      subscription.remove();
    };
    // The app-state listener is tied to token presence; refreshMe reads the latest session through state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (input: LoginInput) => {
    const data = await loginApi({ ...input, email: input.email.trim().toLowerCase() });
    if (data.available_surfaces?.mobile === false) {
      throw new Error("Bu rol mobil uygulamadan giriş yapamaz. Lütfen web paneli kullanın.");
    }
    if (!data.accessToken) {
      throw new Error("Oturum bilgisi alınamadı.");
    }

    queryClient.clear();

    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    setToken(data.accessToken);
    applySessionPayload(data);
    await syncNotificationPermissionSafely({ allowPromptScreen: true });
  };

  const switchRole = async (role: SessionRole) => {
    const data = await switchRoleApi(role);
    if (data.available_surfaces?.mobile === false) {
      throw new Error("Bu rol mobil uygulamadan açılamaz. Lütfen web paneli kullanın.");
    }
    if (!data.accessToken) {
      throw new Error("Yeni rol oturumu başlatılamadı.");
    }

    queryClient.clear();

    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    setToken(data.accessToken);
    applySessionPayload(data);
    await syncNotificationPermissionSafely();
  };

  const register = async (input: RegisterInput) => {
    const data = await registerApi({ ...input, email: input.email.trim().toLowerCase() });
    if (!data.accessToken) {
      throw new Error("Kayıt sonrası oturum başlatılamadı.");
    }

    queryClient.clear();

    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    setToken(data.accessToken);
    applySessionPayload(data);
    await syncNotificationPermissionSafely({ allowPromptScreen: true });
  };

  const logout = async () => {
    try {
      await unregisterPushDevice(pushToken);
    } catch {
      // ignore device unregister errors on logout
    }

    try {
      await logoutApi();
    } catch {
      // ignore API logout errors if token already invalid
    }

    await clearSessionState();
  };

  const deleteAccount = async () => {
    try {
      await unregisterPushDevice(pushToken);
    } catch {
      // ignore device unregister errors during account deletion
    }

    await deleteAccountApi();
    await clearSessionState();
  };

  const acceptInvite = async (input: InviteAcceptInput) => {
    await inviteAcceptApi(input);
  };

  const value = useMemo<SessionContextType>(
    () => ({
      user,
      loading,
      token,
      onboardingState,
      membershipState,
      membershipStatus,
      recommendedEntrySurface,
      hasActiveMembership,
      hasPendingApplication,
      hasManagedClinic,
      availablePersonas,
      activeMembership,
      managedClinic,
      pendingApplication,
      pendingPaymentRequest,
      activeChangeRequests,
      availableMobileActions,
      scanCapabilities,
      availableSurfaces,
      pendingPostAuthScreen,
      notificationPermissionStatus,
      clearPendingPostAuthScreen: () => setPendingPostAuthScreen(null),
      dismissNotificationPermissionPrompt,
      requestNotificationPermission,
      refreshNotificationPermissionStatus: () => syncNotificationPermissionSafely(),
      login,
      switchRole,
      register,
      logout,
      deleteAccount,
      acceptInvite,
      refreshMe,
    }),
    // Action functions intentionally stay outside the memo deps to keep the provider value stable between state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, token, onboardingState, membershipState, membershipStatus, recommendedEntrySurface, hasActiveMembership, hasPendingApplication, hasManagedClinic, availablePersonas, activeMembership, managedClinic, pendingApplication, pendingPaymentRequest, activeChangeRequests, availableMobileActions, scanCapabilities, availableSurfaces, pendingPostAuthScreen, notificationPermissionStatus]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return ctx;
}
