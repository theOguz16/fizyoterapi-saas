type RouterLike = {
  back: () => void;
  push: (href: any) => void;
  replace?: (href: any) => void;
  canGoBack?: () => boolean;
};

type Role = "ADMIN" | "TRAINER" | "MEMBER";

type SessionLikeUser = {
  role?: Role | string | null;
};

type AvailableSurfaces = {
  mobile?: boolean;
} | null | undefined;

type RecommendedEntrySurface =
  | "ADMIN_HOME"
  | "OWNER_SETUP"
  | "MEMBER_HOME"
  | "DISCOVERY"
  | "APPLICATION_STATUS"
  | "TRAINER_HOME"
  | null
  | undefined;

type OnboardingState =
  | "NO_SALON"
  | "PENDING_APPLICATION"
  | "DAY_SELECTION_REQUIRED"
  | "PACKAGE_SELECTION_REQUIRED"
  | "TRAINER_SELECTION_REQUIRED"
  | "PAYMENT_PENDING"
  | "ACTIVE_SALON"
  | "NO_CLINIC"
  | "PENDING_CLINIC_REVIEW"
  | "CLINIC_REJECTED"
  | "CLINIC_READ_ONLY"
  | string
  | null
  | undefined;

type RootNavigationUser = {
  role?: Role | string | null;
  tenantSlug?: string | null;
} | null;

type RootNavigationInput = {
  loading: boolean;
  pendingSalonSlug: string | null | undefined;
  user: RootNavigationUser;
  onboardingState?: OnboardingState;
  mobileAvailable?: boolean;
  pendingPostAuthScreen?: "NOTIFICATION_PERMISSION" | null;
  signupFlowState: "idle" | "assessment" | "post-assessment";
  selectedPersona?: Role | null;
  segments: readonly string[];
};

export type RootNavigationDecision =
  | { type: "none"; reason: string }
  | { type: "replace"; href: string; reason: string };

export function safeBack(router: RouterLike, fallbackHref: string, mode: "push" | "replace" = "replace") {
  if (mode === "push") {
    router.push(fallbackHref as never);
    return;
  }

  if (typeof router.replace === "function") {
    router.replace(fallbackHref as never);
    return;
  }

  router.push(fallbackHref as never);
}

export function resolveBackNavigation(canGoBack: boolean, fallbackHref?: string | null) {
  if (fallbackHref) return { type: "replace" as const, href: fallbackHref };
  if (canGoBack) return { type: "back" as const };
  return { type: "back" as const };
}

export function resolveRoleGroup(role: Role, onboardingState?: OnboardingState, _user?: SessionLikeUser | null) {
  if (role === "ADMIN") {
    return "(admin)";
  }

  if (role === "TRAINER") {
    return onboardingState === "NO_SALON" ? "(shared)" : "(trainer)";
  }

  if (role === "MEMBER") {
    return onboardingState === "ACTIVE_SALON" ? "(member)" : "(intake-member)";
  }

  return "(auth)";
}

export function resolveAdminHome(onboardingState?: OnboardingState) {
  if (onboardingState === "NO_CLINIC") {
    return "/(admin)/salon/setup";
  }
  if (onboardingState === "CLINIC_READ_ONLY") {
    return "/(admin)/subscription";
  }

  return "/(admin)/dashboard";
}

export function resolveMemberHome(onboardingState?: OnboardingState) {
  switch (onboardingState) {
    case "ACTIVE_SALON":
      return "/(member)/home";
    case "PAYMENT_PENDING":
    case "PENDING_APPLICATION":
      return "/(intake-member)/approval-pending";
    case "DAY_SELECTION_REQUIRED":
      return "/(intake-member)/time-selection";
    case "TRAINER_SELECTION_REQUIRED":
      return "/(intake-member)/trainer-selection";
    case "PACKAGE_SELECTION_REQUIRED":
      return "/(intake-member)/packages";
    case "NO_SALON":
    default:
      return "/(intake-member)";
  }
}

export function resolveRoleHome(role: Role, onboardingState?: OnboardingState, _user?: SessionLikeUser | null) {
  if (role === "ADMIN") {
    return resolveAdminHome(onboardingState);
  }

  if (role === "TRAINER") {
    if (onboardingState === "NO_SALON") return "/(shared)/invite-join";
    return "/(trainer)/home";
  }

  if (role === "MEMBER") {
    return resolveMemberHome(onboardingState);
  }

  return "/(auth)/welcome";
}

function normalizeSlugValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function resolvePendingSalonHome(input: {
  pendingSalonSlug: string | null | undefined;
  user: RootNavigationUser;
  onboardingState?: OnboardingState;
}) {
  const pendingSlug = normalizeSlugValue(input.pendingSalonSlug);
  if (!pendingSlug) return null;

  if (!input.user) {
    return `/(intake-member)/salons/${pendingSlug}`;
  }

  if (input.user.role !== "MEMBER") {
    return null;
  }

  if (input.onboardingState !== "ACTIVE_SALON") {
    return `/(intake-member)/salons/${pendingSlug}`;
  }

  return "/(member)/home";
}

export function resolveRootNavigation(input: RootNavigationInput): RootNavigationDecision {
  if (input.loading || input.pendingSalonSlug === undefined) {
    return { type: "none", reason: "BOOTSTRAP_PENDING" };
  }

  const currentGroup = input.segments[0];
  const currentRoute = input.segments.join("/");
  const authLeaf = input.segments.at(1);
  const sharedLeaf = input.segments.at(1);
  const inAuthGroup = currentGroup === "(auth)";
  const inIntakeGroup = currentGroup === "(intake-member)";
  const inSharedGroup = currentGroup === "(shared)";

  if (currentRoute === "e2e-reset" || currentRoute === "e2e-login") {
    return { type: "none", reason: "E2E_ROUTE" };
  }

  const allowedSignupLeaves =
    input.signupFlowState === "assessment"
      ? ["role-assessment"]
      : input.selectedPersona === "ADMIN"
        ? ["owner-plan", "register"]
        : input.selectedPersona === "TRAINER"
          ? ["trainer-invite-guide", "invite-accept"]
          : ["register"];

  if (!input.user && !inAuthGroup && !inIntakeGroup) {
    return { type: "replace", href: "/(auth)/welcome", reason: "AUTH_REQUIRED" };
  }

  if (!input.user) {
    if (input.signupFlowState !== "idle" && !allowedSignupLeaves.includes(authLeaf || "")) {
      return {
        type: "replace",
        href: `/(auth)/${allowedSignupLeaves[0]}`,
        reason: "SIGNUP_FLOW_GUARD",
      };
    }

    return { type: "none", reason: "UNAUTHENTICATED_ROUTE_ALLOWED" };
  }

  if (input.mobileAvailable === false) {
    return { type: "replace", href: "/(auth)/welcome", reason: "MOBILE_SURFACE_DISABLED" };
  }

  const role = input.user.role as Role;
  const pendingSalonHome = resolvePendingSalonHome({
    pendingSalonSlug: input.pendingSalonSlug,
    user: input.user,
    onboardingState: input.onboardingState,
  });
  const expectedGroup = resolveRoleGroup(role, input.onboardingState, input.user);
  const nextHome = pendingSalonHome || resolveRoleHome(role, input.onboardingState, input.user);
  const allowMemberConnectionAuthFlow =
    role === "MEMBER" &&
    input.onboardingState === "NO_SALON" &&
    inAuthGroup &&
    ["scan-salon-qr", "invite-accept"].includes(authLeaf || "");
  const allowMemberPurchaseFlow =
    role === "MEMBER" &&
    inIntakeGroup &&
    input.onboardingState === "ACTIVE_SALON" &&
    !pendingSalonHome;
  const allowSharedUtilityFlow =
    inSharedGroup && ["notification-settings", "leave-salon", "invite-join"].includes(sharedLeaf || "");

  if (
    inAuthGroup &&
    input.pendingPostAuthScreen === "NOTIFICATION_PERMISSION" &&
    authLeaf !== "notification-permission"
  ) {
    return {
      type: "replace",
      href: "/(auth)/notification-permission",
      reason: "NOTIFICATION_PERMISSION_REQUIRED",
    };
  }

  if (inAuthGroup && input.pendingPostAuthScreen === "NOTIFICATION_PERMISSION") {
    return { type: "none", reason: "NOTIFICATION_PERMISSION_ACTIVE" };
  }

  if (inAuthGroup && authLeaf !== "notification-permission" && !allowMemberConnectionAuthFlow) {
    return { type: "replace", href: nextHome, reason: "AUTH_FLOW_COMPLETE" };
  }

  if (
    currentGroup &&
    currentGroup !== expectedGroup &&
    !allowMemberPurchaseFlow &&
    !allowSharedUtilityFlow &&
    !allowMemberConnectionAuthFlow
  ) {
    return { type: "replace", href: nextHome, reason: "ROLE_GROUP_MISMATCH" };
  }

  return { type: "none", reason: "CURRENT_ROUTE_ALLOWED" };
}

export function resolveIndexRedirect(
  user: SessionLikeUser | null,
  onboardingState?: OnboardingState,
  availableSurfaces?: AvailableSurfaces,
  recommendedEntrySurface?: RecommendedEntrySurface
) {
  if (!user) {
    return "/(auth)/welcome";
  }

  if (availableSurfaces?.mobile === false) {
    return "/(auth)/welcome";
  }

  const role = user.role as Role;

  if (role === "ADMIN") {
    if (recommendedEntrySurface === "OWNER_SETUP" || onboardingState === "NO_CLINIC") {
      return "/(admin)/salon/setup";
    }
    if (onboardingState === "CLINIC_READ_ONLY") {
      return "/(admin)/subscription";
    }
    return "/(admin)/dashboard";
  }

  if (role === "TRAINER") {
    if (onboardingState === "NO_SALON") {
      return "/(shared)/invite-join";
    }
    return recommendedEntrySurface === "TRAINER_HOME" ? "/(trainer)/home" : "/(trainer)/home";
  }

  if (role === "MEMBER") {
    if (recommendedEntrySurface === "MEMBER_HOME" && onboardingState === "ACTIVE_SALON") {
      return "/(member)/home";
    }
    if (recommendedEntrySurface === "DISCOVERY") {
      return "/(intake-member)/salons";
    }
    if (recommendedEntrySurface === "APPLICATION_STATUS") {
      return "/(intake-member)/approval-pending";
    }
    return resolveRoleHome("MEMBER", onboardingState, user);
  }

  return "/(auth)/welcome";
}

export function resolveContextualBackHref(segments: string[]) {
  const routeKey = segments.join("/");

  const routeMap: Record<string, string> = {
    "(admin)/approval/[id]": "/(admin)/approvals",
    "(admin)/campaign-create": "/(admin)/campaigns",
    "(admin)/campaigns": "/(admin)/dashboard",
    "(admin)/campaigns/new": "/(admin)/campaigns",
    "(admin)/clinic-qr": "/(admin)/dashboard",
    "(admin)/dashboard/revenue-detail": "/(admin)/dashboard",
    "(admin)/dashboard/risk-preview": "/(admin)/dashboard",
    "(admin)/entry-scan": "/(admin)/dashboard",
    "(admin)/members/[id]": "/(admin)/members",
    "(admin)/notifications": "/(admin)/dashboard",
    "(admin)/packages": "/(admin)/salon",
    "(admin)/pricing": "/(admin)/salon",
    "(admin)/risk-members": "/(admin)/dashboard",
    "(admin)/salon": "/(admin)/dashboard",
    "(admin)/salon/setup": "/(admin)/dashboard",
    "(admin)/salon-profile": "/(admin)/salon",
    "(admin)/subscription": "/(admin)/salon",
    "(admin)/working-hours": "/(admin)/salon",

    "(member)/attendance": "/(member)/home",
    "(member)/booking/[id]": "/(member)/bookings",
    "(member)/bookings": "/(member)/home",
    "(member)/campaigns": "/(member)/profile",
    "(member)/group-classes": "/(member)/home",
    "(member)/measurement/[id]": "/(member)/measurements",
    "(member)/plan": "/(member)/package",
    "(member)/progress": "/(member)/profile",
    "(member)/qr/fullscreen": "/(member)/profile",
    "(member)/referrals": "/(member)/profile",

    "(trainer)/bookings": "/(trainer)/calendar",
    "(trainer)/checkin": "/(trainer)/home",
    "(trainer)/group-classes": "/(trainer)/home",
    "(trainer)/members": "/(trainer)/clients",
    "(trainer)/manual-code": "/(trainer)/home",
    "(trainer)/members/[id]": "/(trainer)/clients",
    "(trainer)/note-edit": "/(trainer)/clients",
    "(trainer)/notes": "/(trainer)/clients",
    "(trainer)/packages": "/(trainer)/home",
    "(trainer)/qr": "/(trainer)/home",
    "(trainer)/risk": "/(trainer)/home",
    "(trainer)/today": "/(trainer)/home",

    "(shared)/clinics": "/(shared)/invite-join",
    "(shared)/leave-salon": "/(member)/profile",
    "(shared)/notification-settings": "/(member)/profile",
  };

  return routeMap[routeKey] ?? null;
}
