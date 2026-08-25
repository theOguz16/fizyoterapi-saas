import type { SessionRole } from "@/lib/mobile-api";

export type AccountActionId = "LEAVE_SALON" | "SUPPORT" | "DELETE_ACCOUNT" | "LOGOUT";

export type AccountActionDefinition = Readonly<{
  id: AccountActionId;
  destructive: boolean;
}>;

export function getAccountActionsForRole(role?: SessionRole | null): readonly AccountActionDefinition[] {
  const common: AccountActionDefinition[] = [
    { id: "SUPPORT", destructive: false },
    { id: "DELETE_ACCOUNT", destructive: true },
    { id: "LOGOUT", destructive: false },
  ];

  if (role === "MEMBER") {
    return [{ id: "LEAVE_SALON", destructive: true }, ...common];
  }

  return common;
}

export function getProfileRouteForRole(role?: SessionRole | null) {
  if (role === "ADMIN") return "/(admin)/profile";
  if (role === "TRAINER") return "/(trainer)/profile";
  return "/(member)/profile";
}
