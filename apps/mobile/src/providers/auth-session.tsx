// Bu provider mobil uygulamada auth session ile ilgili ortak state veya servis erisimini merkezilestirir.
// Ekranlar arasi tekrar eden baglam ihtiyaci bu dosya uzerinden yonetilir.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "@/lib/http-client";
import { flushProductEventQueue } from "@/lib/product-analytics";
import { deleteAccountApi, inviteAcceptApi, loginApi, logoutApi, meApi, registerApi, registerClinicMemberApi, SessionEnvelope, SessionRole, SessionUser, switchRoleApi } from "@/lib/mobile-api";
import { clearPendingSalonJoinSlug, getNotificationPermissionPromptState, setNotificationPermissionPromptState } from "@/lib/local-preferences";
import { getPushPermissionStatus, registerPushDeviceIfPermitted, requestPushPermissionAndRegister, type PushPermissionStatus, unregisterPushDevice } from "@/lib/push";
import { authenticateWithBiometrics, disableBiometricLogin, enableBiometricLoginIfAvailable, getBiometricState } from "@/lib/biometric-auth";
import {
  createEmptySessionSnapshot,
  sessionSnapshotReducer,
  type SessionEnvelopeInput,
} from "@/lib/mobile-session";
import type { RegistrationLegalConsent } from "@fitnes-saas/contracts";

const TOKEN_KEY = "fizyoflow.access_token";

type AuthRuntimeState = {
  token: string | null;
  loading: boolean;
};

type PushRuntimeState = {
  token: string | null;
  permissionStatus: PushPermissionStatus;
  pendingPostAuthScreen: "NOTIFICATION_PERMISSION" | null;
};

const EMPTY_PUSH_RUNTIME: PushRuntimeState = {
  token: null,
  permissionStatus: "undetermined",
  pendingPostAuthScreen: null,
};

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
  account_type?: "CLINIC_ADMIN";
  onboarding_profile?: {
    role: "ADMIN";
    primary_goal: string;
    rhythm: string;
    support_style: string;
  };
  legal_consent: RegistrationLegalConsent;
};

type ClinicMemberRegisterInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  tenant_slug: string;
  join_source: "QR" | "DEEPLINK" | "INVITE" | "DISCOVERY";
  legal_consent: RegistrationLegalConsent;
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
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  enableBiometricLogin: () => Promise<void>;
  disableBiometricLogin: () => Promise<void>;
  clearPendingPostAuthScreen: () => void;
  dismissNotificationPermissionPrompt: () => Promise<void>;
  requestNotificationPermission: () => Promise<PushPermissionStatus>;
  refreshNotificationPermissionStatus: () => Promise<PushPermissionStatus>;
  login: (input: LoginInput) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  switchRole: (role: SessionRole) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  registerClinicMember: (input: ClinicMemberRegisterInput) => Promise<void>;
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
  const [session, dispatchSession] = useReducer(
    sessionSnapshotReducer,
    undefined,
    createEmptySessionSnapshot
  );
  const [authRuntime, setAuthRuntime] = useState<AuthRuntimeState>({ token: null, loading: true });
  const [pushRuntime, setPushRuntime] = useState<PushRuntimeState>(EMPTY_PUSH_RUNTIME);
  const [biometricState, setBiometricState] = useState({
    available: false,
    enabled: false,
    label: "Biyometrik giriş",
  });

  const applySessionPayload = useCallback((payload: SessionEnvelopeInput) => {
    dispatchSession({ type: "APPLY", payload });
  }, []);

  const clearSessionState = useCallback(async () => {
    // Logout ve token invalid durumlari ayni temizlik adimini kullanir.
    setAuthToken(null);
    setAuthRuntime((current) => ({ ...current, token: null }));
    dispatchSession({ type: "RESET" });
    setPushRuntime(EMPTY_PUSH_RUNTIME);
    setBiometricState({ available: false, enabled: false, label: "Biyometrik giriş" });

    queryClient.clear();

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await disableBiometricLogin();
  }, [queryClient]);

  const {
    user,
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
  } = session;
  const { token, loading } = authRuntime;
  const {
    token: pushToken,
    permissionStatus: notificationPermissionStatus,
    pendingPostAuthScreen,
  } = pushRuntime;
  const {
    available: biometricAvailable,
    enabled: biometricEnabled,
    label: biometricLabel,
  } = biometricState;

  const refreshBiometricState = useCallback(async () => {
    const state = await getBiometricState();
    setBiometricState(state);
    return state;
  }, []);

  const syncNotificationPermission = useCallback(async (options?: { allowPromptScreen?: boolean }) => {
    const status = await getPushPermissionStatus();
    setPushRuntime((current) => ({ ...current, permissionStatus: status }));

    if (status === "granted") {
      const push = await registerPushDeviceIfPermitted();
      setPushRuntime({
        token: push.token,
        permissionStatus: status,
        pendingPostAuthScreen: null,
      });
      await setNotificationPermissionPromptState({
        hasSeenPrompt: true,
        lastKnownStatus: "granted",
        updatedAt: new Date().toISOString(),
      });
      return status;
    }

    if (pushToken) {
      await unregisterPushDevice(pushToken).catch(() => null);
    }
    const promptState = await getNotificationPermissionPromptState();
    await setNotificationPermissionPromptState({
      hasSeenPrompt: promptState.hasSeenPrompt,
      lastKnownStatus: status,
      updatedAt: new Date().toISOString(),
    });
    setPushRuntime({
      token: null,
      permissionStatus: status,
      pendingPostAuthScreen:
        options?.allowPromptScreen && !promptState.hasSeenPrompt ? "NOTIFICATION_PERMISSION" : null,
    });
    return status;
  }, [pushToken]);

  const syncNotificationPermissionSafely = useCallback(async (options?: { allowPromptScreen?: boolean }) => {
    try {
      return await syncNotificationPermission(options);
    } catch {
      setPushRuntime((current) => ({ ...current, token: null }));
      return notificationPermissionStatus;
    }
  }, [notificationPermissionStatus, syncNotificationPermission]);

  const dismissNotificationPermissionPrompt = useCallback(async () => {
    await setNotificationPermissionPromptState({
      hasSeenPrompt: true,
      lastKnownStatus: notificationPermissionStatus,
      updatedAt: new Date().toISOString(),
    });
    setPushRuntime((current) => ({ ...current, pendingPostAuthScreen: null }));
  }, [notificationPermissionStatus]);

  const requestNotificationPermission = useCallback(async () => {
    const result = await requestPushPermissionAndRegister();
    if (result.status !== "granted" && pushToken) {
      await unregisterPushDevice(pushToken).catch(() => null);
    }
    setPushRuntime({
      token: result.token,
      permissionStatus: result.status,
      pendingPostAuthScreen: null,
    });
    await setNotificationPermissionPromptState({
      hasSeenPrompt: true,
      lastKnownStatus: result.status,
      updatedAt: new Date().toISOString(),
    });
    return result.status;
  }, [pushToken]);

  const activateAuthenticatedSession = useCallback(async (
    data: SessionEnvelope & { accessToken: string },
    options?: { refreshBiometric?: boolean; allowNotificationPrompt?: boolean }
  ) => {
    queryClient.clear();
    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);

    if (options?.refreshBiometric) {
      await refreshBiometricState();
    }

    setAuthToken(data.accessToken);
    void flushProductEventQueue().catch(() => undefined);
    setAuthRuntime((current) => ({ ...current, token: data.accessToken }));
    applySessionPayload(data);
    await syncNotificationPermissionSafely({
      allowPromptScreen: options?.allowNotificationPrompt,
    });
  }, [applySessionPayload, queryClient, refreshBiometricState, syncNotificationPermissionSafely]);

  const refreshMe = useCallback(async () => {
    const me = await meApi();
    if (me.available_surfaces?.mobile === false) {
      await clearSessionState();
      throw new Error("Bu rol mobil uygulamadan giriş yapamaz. Lütfen web paneli kullanın.");
    }
    applySessionPayload(me);
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
  }, [applySessionPayload, clearSessionState, queryClient]);

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
          setAuthRuntime((current) => ({ ...current, token: null }));
          applySessionPayload({});
          await refreshBiometricState();
          return;
        }

        const biometricState = await refreshBiometricState();
        if (biometricState.available && biometricState.enabled) {
          setAuthToken(null);
          setAuthRuntime((current) => ({ ...current, token: null }));
          applySessionPayload({});
          return;
        }

        setAuthToken(stored);
        void flushProductEventQueue().catch(() => undefined);
        setAuthRuntime((current) => ({ ...current, token: stored }));
        const me = await meApi();
        if (!mounted) return;
        if (me.available_surfaces?.mobile === false) {
          await clearSessionState();
          return;
        }
        applySessionPayload(me);
        await syncNotificationPermissionSafely();
      } catch {
        await clearSessionState();
      } finally {
        if (mounted) setAuthRuntime((current) => ({ ...current, loading: false }));
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
    if (!hasActiveMembership && !hasPendingApplication && !pendingPaymentRequest) return;
    void clearPendingSalonJoinSlug();
  }, [hasActiveMembership, hasPendingApplication, pendingPaymentRequest]);

  useEffect(() => {
    if (!token) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshMe().catch(() => null);
        void syncNotificationPermissionSafely().catch(() => null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshMe, syncNotificationPermissionSafely, token]);

  const login = useCallback(async (input: LoginInput) => {
    const data = await loginApi({ ...input, email: input.email.trim().toLowerCase() });
    if (data.available_surfaces?.mobile === false) {
      throw new Error("Bu rol mobil uygulamadan giriş yapamaz. Lütfen web paneli kullanın.");
    }
    if (!data.accessToken) {
      throw new Error("Oturum bilgisi alınamadı.");
    }

    await activateAuthenticatedSession({ ...data, accessToken: data.accessToken }, {
      refreshBiometric: true,
      allowNotificationPrompt: !input.tenantSlug,
    });
  }, [activateAuthenticatedSession]);

  const switchRole = useCallback(async (role: SessionRole) => {
    const data = await switchRoleApi(role);
    if (data.available_surfaces?.mobile === false) {
      throw new Error("Bu rol mobil uygulamadan açılamaz. Lütfen web paneli kullanın.");
    }
    if (!data.accessToken) {
      throw new Error("Yeni rol oturumu başlatılamadı.");
    }

    await activateAuthenticatedSession({ ...data, accessToken: data.accessToken });
  }, [activateAuthenticatedSession]);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await registerApi({ ...input, email: input.email.trim().toLowerCase() });
    if (!data.accessToken) {
      throw new Error("Kayıt sonrası oturum başlatılamadı.");
    }

    await activateAuthenticatedSession({ ...data, accessToken: data.accessToken }, {
      refreshBiometric: true,
      allowNotificationPrompt: false,
    });
  }, [activateAuthenticatedSession]);

  const registerClinicMember = useCallback(async (input: ClinicMemberRegisterInput) => {
    const data = await registerClinicMemberApi({ ...input, email: input.email.trim().toLowerCase() });
    if (!data.accessToken) {
      throw new Error("Kayıt sonrası danışan oturumu başlatılamadı.");
    }

    await activateAuthenticatedSession({ ...data, accessToken: data.accessToken }, {
      refreshBiometric: true,
      allowNotificationPrompt: false,
    });
  }, [activateAuthenticatedSession]);

  const logout = useCallback(async () => {
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
  }, [clearSessionState, pushToken]);

  const loginWithBiometrics = useCallback(async () => {
    const state = await refreshBiometricState();
    if (!state.available || !state.enabled) {
      throw new Error("Bu cihazda hızlı giriş hazır değil. E-posta ve şifrenle giriş yapabilirsin.");
    }

    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!stored) {
      await disableBiometricLogin();
      await refreshBiometricState();
      throw new Error("Hızlı giriş için önce e-posta ve şifrenle giriş yapman gerekiyor.");
    }

    const result = await authenticateWithBiometrics(state.label);
    if (!result.success) {
      throw new Error("Giriş onaylanmadı.");
    }

    try {
      queryClient.clear();
      setAuthToken(stored);
      void flushProductEventQueue().catch(() => undefined);
      setAuthRuntime((current) => ({ ...current, token: stored }));
      const me = await meApi();
      if (me.available_surfaces?.mobile === false) {
        await clearSessionState();
        throw new Error("Bu rol mobil uygulamadan giriş yapamaz. Lütfen web paneli kullanın.");
      }
      applySessionPayload(me);
      await syncNotificationPermissionSafely({ allowPromptScreen: true });
    } catch (error) {
      await clearSessionState();
      throw error;
    }
  }, [applySessionPayload, clearSessionState, queryClient, refreshBiometricState, syncNotificationPermissionSafely]);

  const deleteAccount = useCallback(async () => {
    try {
      await unregisterPushDevice(pushToken);
    } catch {
      // ignore device unregister errors during account deletion
    }

    await deleteAccountApi();
    await clearSessionState();
  }, [clearSessionState, pushToken]);

  const acceptInvite = useCallback(async (input: InviteAcceptInput) => {
    await inviteAcceptApi(input);
  }, []);

  const enableBiometricLogin = useCallback(async () => {
    const state = await enableBiometricLoginIfAvailable();
    setBiometricState(state);
    if (!state.available) {
      throw new Error("Bu cihazda Face ID veya Touch ID hazır değil.");
    }
  }, []);

  const disableBiometricLoginAction = useCallback(async () => {
    await disableBiometricLogin();
    await refreshBiometricState();
  }, [refreshBiometricState]);

  const clearPendingPostAuthScreen = useCallback(() => {
    setPushRuntime((current) => ({ ...current, pendingPostAuthScreen: null }));
  }, []);

  const refreshNotificationPermissionStatus = useCallback(
    () => syncNotificationPermissionSafely(),
    [syncNotificationPermissionSafely]
  );

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
      biometricAvailable,
      biometricEnabled,
      biometricLabel,
      enableBiometricLogin,
      disableBiometricLogin: disableBiometricLoginAction,
      clearPendingPostAuthScreen,
      dismissNotificationPermissionPrompt,
      requestNotificationPermission,
      refreshNotificationPermissionStatus,
      login,
      loginWithBiometrics,
      switchRole,
      register,
      registerClinicMember,
      logout,
      deleteAccount,
      acceptInvite,
      refreshMe,
    }),
    [
      acceptInvite,
      activeChangeRequests,
      activeMembership,
      availableMobileActions,
      availablePersonas,
      availableSurfaces,
      biometricAvailable,
      biometricEnabled,
      biometricLabel,
      clearPendingPostAuthScreen,
      deleteAccount,
      disableBiometricLoginAction,
      dismissNotificationPermissionPrompt,
      enableBiometricLogin,
      hasActiveMembership,
      hasManagedClinic,
      hasPendingApplication,
      loading,
      login,
      loginWithBiometrics,
      logout,
      managedClinic,
      membershipState,
      membershipStatus,
      notificationPermissionStatus,
      onboardingState,
      pendingApplication,
      pendingPaymentRequest,
      pendingPostAuthScreen,
      recommendedEntrySurface,
      refreshMe,
      refreshNotificationPermissionStatus,
      register,
      registerClinicMember,
      requestNotificationPermission,
      scanCapabilities,
      switchRole,
      token,
      user,
    ]
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
