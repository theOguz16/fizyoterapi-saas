"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session";
import type { Role } from "@/lib/auth-types";
import { resolveGuardRedirect } from "@/lib/role-routing";

export function useRequireRole(role: Role) {
  const router = useRouter();
  const { loading, user } = useAuthSession();

  useEffect(() => {
    if (loading) return;
    const nextRoute = resolveGuardRedirect(user?.role, role);
    if (nextRoute) {
      router.replace(nextRoute);
    }
  }, [loading, role, router, user]);

  return { loading, user };
}
