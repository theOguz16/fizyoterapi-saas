"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { useAuthSession } from "@/lib/auth-session";

export function RootLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuthSession();
  const hideHeader = pathname === "/login" || pathname?.startsWith("/invite/accept");

  useEffect(() => {
    if (loading) return;
    if (user?.role === "MEMBER" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  return (
    <>
      {!hideHeader ? <AppHeader /> : null}
      <div className={hideHeader ? "" : "pt-[132px] xl:pt-20"}>{children}</div>
    </>
  );
}
