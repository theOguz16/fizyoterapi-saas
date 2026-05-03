type RouterLike = {
  back: () => void;
  push: (href: any) => void;
  replace?: (href: any) => void;
  canGoBack?: () => boolean;
};

type Role = "ADMIN" | "TRAINER" | "MEMBER";

type SessionLikeUser = {
  role?: Role | string;
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

export function safeBack(router: RouterLike, fallbackHref: string, mode: "push" | "replace" = "replace") {
  if (typeof router.canGoBack === "function" && router.canGoBack()) {
    router.back();
    return;
  }

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
    "(admin)/salon-profile": "/(admin)/salon",
    "(admin)/subscription": "/(admin)/salon",
    "(admin)/working-hours": "/(admin)/salon",

    "(member)/attendance": "/(member)/home",
    "(member)/booking/[id]": "/(member)/bookings",
    "(member)/bookings": "/(member)/home",
    "(member)/campaigns": "/(member)/profile",
    "(member)/measurement/[id]": "/(member)/measurements",
    "(member)/plan": "/(member)/package",
    "(member)/progress": "/(member)/profile",
    "(member)/qr/fullscreen": "/(member)/profile",
    "(member)/referrals": "/(member)/profile",

    "(trainer)/bookings": "/(trainer)/calendar",
    "(trainer)/checkin": "/(trainer)/home",
    "(trainer)/members": "/(trainer)/clients",
    "(trainer)/manual-code": "/(trainer)/home",
    "(trainer)/members/[id]": "/(trainer)/clients",
    "(trainer)/note-edit": "/(trainer)/clients",
    "(trainer)/notes": "/(trainer)/clients",
    "(trainer)/packages": "/(trainer)/home",
    "(trainer)/qr": "/(trainer)/home",
    "(trainer)/risk": "/(trainer)/home",
    "(trainer)/today": "/(trainer)/home",
  };

  return routeMap[routeKey] ?? null;
}
