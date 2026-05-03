"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthSessionSnapshot, AuthUser, Role } from "@/lib/auth-types";
import { webAuthRequest } from "@/lib/web-auth-client";

type AuthSessionState = {
  loading: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionState>({
  loading: true,
  user: null,
  refresh: async () => {},
});

export function AuthSessionProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot?: AuthSessionSnapshot;
}) {
  const [loading, setLoading] = useState(initialSnapshot ? !initialSnapshot.resolved : true);
  const [user, setUser] = useState<AuthUser | null>(initialSnapshot?.user ?? null);

  async function refresh() {
    try {
      const payload = await webAuthRequest<{ data?: { user?: AuthUser; available_surfaces?: { web?: boolean } } }>("/api/auth/me");
      if (payload?.data?.user && payload?.data?.available_surfaces?.web !== false) {
        setUser({
          ...payload.data.user,
          tenantId: payload.data.user.tenantId || "",
          tenantSlug: payload.data.user.tenantSlug || "",
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialSnapshot?.resolved) {
      return;
    }
    void refresh();
  }, [initialSnapshot?.resolved]);

  return (
    <AuthSessionContext.Provider value={{ loading, user, refresh }}>{children as any}</AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
