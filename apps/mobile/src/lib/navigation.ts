import type { AppIconName } from "@/theme/components/app-icon";

type RouterLike = {
  back: () => void;
  push: (href: any) => void;
  replace?: (href: any) => void;
  canGoBack?: () => boolean;
};

export type MobileRole = "ADMIN" | "TRAINER" | "MEMBER";

type Role = MobileRole;

export type RoleRouteDefinition = Readonly<{
  role: MobileRole;
  authorizedRoles: readonly MobileRole[];
  name: string;
  visibility: "tab" | "hidden";
  title: string | null;
  icon: AppIconName | null;
  featured: boolean;
  backHref: string | null;
  includeInLayout: boolean;
}>;

type RoleRouteSeed = Omit<RoleRouteDefinition, "role" | "authorizedRoles">;

function defineRoleRoutes(role: MobileRole, routes: readonly RoleRouteSeed[]): readonly RoleRouteDefinition[] {
  return routes.map((route) => ({
    ...route,
    role,
    authorizedRoles: [role],
  }));
}

const tabRoute = (
  name: string,
  title: string,
  icon: AppIconName,
  featured = false
): RoleRouteSeed => ({
  name,
  title,
  icon,
  featured,
  visibility: "tab",
  backHref: null,
  includeInLayout: true,
});

const hiddenRoute = (
  name: string,
  backHref: string | null = null,
  includeInLayout = true
): RoleRouteSeed => ({
  name,
  title: null,
  icon: null,
  featured: false,
  visibility: "hidden",
  backHref,
  includeInLayout,
});

export const ROLE_ROUTE_REGISTRY: Readonly<Record<MobileRole, readonly RoleRouteDefinition[]>> = {
  ADMIN: defineRoleRoutes("ADMIN", [
    tabRoute("calendar", "Takvim", "calendar"),
    tabRoute("approvals", "Onaylar", "approvals"),
    tabRoute("dashboard", "Ana Sayfa", "dashboard", true),
    tabRoute("members", "Üyeler", "members"),
    tabRoute("profile", "Profil", "profile"),
    hiddenRoute("salon", "/(admin)/dashboard"),
    hiddenRoute("notifications", "/(admin)/dashboard"),
    hiddenRoute("entry-scan", "/(admin)/dashboard"),
    hiddenRoute("members/[id]", "/(admin)/members"),
    hiddenRoute("dashboard/risk-preview", "/(admin)/dashboard"),
    hiddenRoute("dashboard/revenue-detail", "/(admin)/dashboard"),
    hiddenRoute("approval/[id]", "/(admin)/approvals"),
    hiddenRoute("risk-members", "/(admin)/dashboard"),
    hiddenRoute("campaigns", "/(admin)/dashboard"),
    hiddenRoute("campaigns/new", "/(admin)/campaigns"),
    hiddenRoute("working-hours", "/(admin)/salon"),
    hiddenRoute("pricing", "/(admin)/salon"),
    hiddenRoute("packages", "/(admin)/salon"),
    hiddenRoute("subscription", "/(admin)/salon"),
    hiddenRoute("subscription-history"),
    hiddenRoute("revenue-report"),
    hiddenRoute("salon-profile", "/(admin)/salon"),
    hiddenRoute("clinic-qr", "/(admin)/dashboard"),
    hiddenRoute("salon/setup", "/(admin)/dashboard"),
    hiddenRoute("campaign-create", "/(admin)/campaigns"),
  ]),
  TRAINER: defineRoleRoutes("TRAINER", [
    tabRoute("calendar", "Takvim", "calendar"),
    tabRoute("clients", "Danışanlar", "clients"),
    tabRoute("home", "Ana Sayfa", "home", true),
    tabRoute("earnings", "Kazanç", "earnings"),
    tabRoute("profile", "Profil", "profile"),
    hiddenRoute("request-center"),
    hiddenRoute("bulk-notification"),
    hiddenRoute("today", "/(trainer)/home"),
    hiddenRoute("packages", "/(trainer)/home"),
    hiddenRoute("qr", "/(trainer)/home"),
    hiddenRoute("bookings", "/(trainer)/calendar"),
    hiddenRoute("checkin", "/(trainer)/home"),
    hiddenRoute("members", "/(trainer)/clients"),
    hiddenRoute("members/[id]", "/(trainer)/clients"),
    hiddenRoute("risk", "/(trainer)/home"),
    hiddenRoute("notes", "/(trainer)/clients"),
    hiddenRoute("note-edit", "/(trainer)/clients"),
    hiddenRoute("group-classes", "/(trainer)/home"),
    hiddenRoute("manual-code", "/(trainer)/home", false),
  ]),
  MEMBER: defineRoleRoutes("MEMBER", [
    tabRoute("calendar", "Takvim", "calendar"),
    tabRoute("package", "Paketim", "package"),
    tabRoute("home", "Ana Sayfa", "home", true),
    tabRoute("measurements", "Ölçümler", "measurements"),
    tabRoute("profile", "Profil", "profile"),
    hiddenRoute("bookings", "/(member)/home"),
    hiddenRoute("group-classes", "/(member)/home"),
    hiddenRoute("plan", "/(member)/package"),
    hiddenRoute("attendance", "/(member)/home"),
    hiddenRoute("booking/[id]", "/(member)/bookings"),
    hiddenRoute("measurement/[id]", "/(member)/measurements"),
    hiddenRoute("referrals", "/(member)/profile"),
    hiddenRoute("qr/fullscreen", "/(member)/profile"),
    hiddenRoute("campaigns", "/(member)/profile"),
    hiddenRoute("progress", "/(member)/profile"),
  ]),
};

export function getRoleRoutes(role: MobileRole) {
  return ROLE_ROUTE_REGISTRY[role];
}

export function getRoleLayoutRoutes(role: MobileRole) {
  return getRoleRoutes(role).filter((route) => route.includeInLayout);
}

export function getRoleTabBarConfig(role: MobileRole) {
  const tabRoutes = getRoleRoutes(role).filter((route) => route.visibility === "tab");

  return {
    iconMap: Object.fromEntries(
      tabRoutes.map((route) => [route.name, route.icon])
    ) as Record<string, AppIconName>,
    featuredRoutes: tabRoutes.filter((route) => route.featured).map((route) => route.name),
  };
}

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
  const groupRole: Partial<Record<string, MobileRole>> = {
    "(admin)": "ADMIN",
    "(trainer)": "TRAINER",
    "(member)": "MEMBER",
  };
  const role = groupRole[segments[0]];
  const routeName = segments.slice(1).join("/");

  if (role) {
    return getRoleRoutes(role).find((route) => route.name === routeName)?.backHref ?? null;
  }

  const sharedRouteMap: Record<string, string> = {
    "(shared)/clinics": "/(shared)/invite-join",
    "(shared)/leave-salon": "/(member)/profile",
    "(shared)/notification-settings": "/(member)/profile",
  };

  return sharedRouteMap[segments.join("/")] ?? null;
}
