import type { Role } from "@/lib/auth-types";

export function resolveRoleHome(role?: Role | null) {
  if (role === "ADMIN") return "/dashboard";
  if (role === "TRAINER") return "/trainer/today";
  return null;
}

export function resolveGuardRedirect(userRole?: Role | null, requiredRole?: Role) {
  if (!userRole) return "/login";
  if (!requiredRole || userRole === requiredRole) return null;
  return resolveRoleHome(userRole) || "/login";
}
