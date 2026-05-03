import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSessionSnapshot, AuthUser, Role } from "@/lib/auth-types";
import { getApiBase } from "@/lib/api-base";

function fallbackPathForRole(role: Role) {
  if (role === "ADMIN") return "/dashboard";
  if (role === "TRAINER") return "/trainer/today";
  return "/login";
}

function getE2EAuthSnapshot(): AuthSessionSnapshot | null {
  if (process.env.E2E_AUTH_BYPASS !== "true") {
    return null;
  }

  const cookieStore = cookies();
  const role = cookieStore.get("e2e_role")?.value as Role | undefined;
  const webEnabled = cookieStore.get("e2e_web_enabled")?.value !== "false";

  if (!role || !webEnabled) {
    return { resolved: true, user: null };
  }

  return {
    resolved: true,
    user: {
      id: cookieStore.get("e2e_user_id")?.value || `${role.toLowerCase()}-1`,
      email: cookieStore.get("e2e_email")?.value || `${role.toLowerCase()}@demo.local`,
      role,
      tenantId: cookieStore.get("e2e_tenant_id")?.value || "tenant-1",
      tenantSlug: cookieStore.get("e2e_tenant_slug")?.value || "demo-salon",
      fullName: cookieStore.get("e2e_full_name")?.value || `Demo ${role}`,
    },
  };
}

export async function getServerAuthSnapshot(): Promise<AuthSessionSnapshot> {
  const e2eSnapshot = getE2EAuthSnapshot();
  if (e2eSnapshot) {
    return e2eSnapshot;
  }

  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!cookieHeader && !accessToken) {
    return { resolved: true, user: null };
  }

  try {
    const response = await fetch(`${getApiBase()}/auth/me`, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { resolved: true, user: null };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: {
        user?: AuthUser;
        available_surfaces?: {
          web?: boolean;
        };
      };
    };

    if (payload?.data?.user && payload.data.available_surfaces?.web !== false) {
      const user = payload.data.user;
      return {
        resolved: true,
        user: {
          ...user,
          tenantId: user.tenantId || "",
          tenantSlug: user.tenantSlug || "",
        },
      };
    }

    return { resolved: true, user: null };
  } catch {
    return { resolved: false, user: null };
  }
}

export async function requireServerRole(role: Role) {
  const snapshot = await getServerAuthSnapshot();

  if (!snapshot.user) {
    redirect("/login");
  }

  if (snapshot.user.role !== role) {
    redirect(fallbackPathForRole(snapshot.user.role));
  }

  return snapshot.user;
}
